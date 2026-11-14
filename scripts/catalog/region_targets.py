#!/usr/bin/env python3
"""Generate exercise_region_targets: which regions of the deep muscle map each catalog exercise works.

    python3 scripts/catalog/region_targets.py --db "$DATABASE_URL" --map ../momentum-muscle-map \\
        --migration supabase/migrations/20261118_exercise_region_targets.sql

Reads the catalog and exercise_muscle_targets from --db (read only), the region ids of the
momentum-muscle-map checkout in --map (src/data/hierarchy.ts) and region_overrides.json, checks the
result (check_region_targets.py), prints coverage, and rewrites the block between the GENERATED SEED
markers of --migration. Without --migration it only checks and prints. --show prints the weights of
some exercises; --compare prints how far the rules are from the hand weights.

Weight scale, per exercise: the strongest region is 1.00; prime movers 0.9-1.0, major synergists
0.4-0.7, minor muscles and stabilisers 0.15-0.3; trivial ones are left out. Regions are unsided part
slugs (a muscle with one part has the same slug at both levels). Unilateral exercises are not sided:
the app mirrors or sides them.

Where the weights come from:
  hand  region_overrides.json, keyed by catalog id: every exercise logged so far, written from
        exercise science. They replace the rules for that exercise completely. A muscle slug in an
        override is shorthand for all of that muscle's parts at the same weight. The generator fails
        if any of the 150 most-logged exercises has no override.
  rule  everything else:
        1. RepDB's muscle list for the exercise (exercise_muscle_targets: primary 1.0, secondary 0.5);
        2. each RepDB muscle is spread over map parts with the shares in BASE (the larger value wins
           where two muscles reach the same part);
        3. RULES adjust the parts by keywords in the exercise name (incline, close-grip, shrug, ...);
        4. weights are divided by the largest, rounded to 0.01, and anything under 0.15 is dropped.
Only facts are used: RepDB's muscle lists and the exercise names. No RepDB text reaches the output.

Re-tuning after the migration has been applied: never edit an applied migration. Create a new one
that contains only `begin;`, the two marker lines and `commit;`, and pass it as --migration; its
block replaces every row of the map_id. The transaction is needed: the block's temp table is dropped
on commit, so outside one it is gone before the next statement. For a new map version, update map_id
in region_overrides.json after checking that the region ids still mean the same; rows of the old
map_id stay for builds that still render it.
"""
import argparse
import json
import os
import re
import sys
from decimal import ROUND_HALF_UP, Decimal

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from check_region_targets import (DEFAULT_MAP, HERE, MapVocab, load_catalog,  # noqa: E402
                                  load_overrides, validate)

MARK_BEGIN = '-- BEGIN GENERATED SEED'
MARK_END = '-- END GENERATED SEED'
MIN_WEIGHT = Decimal('0.15')
CENT = Decimal('0.01')
TOP_N = 150  # the most-logged exercises must all be hand-tuned

# ─── Base mapping: RepDB muscle -> map parts, with shares ────────────────────────────────────────
# Where RepDB has no matching region in the map, the closest visible region takes a reduced share.
BASE = {
    # Sternal head does most of the work in pressing and flying; the angle rules move it up or down.
    'pectoralis_major': {'pectoralis_major_sternal': 1.0, 'pectoralis_major_clavicular': 0.7,
                         'pectoralis_major_abdominal': 0.7},
    'serratus_anterior': {'serratus_anterior_1': 1.0, 'serratus_anterior_2': 1.0, 'serratus_anterior_3': 1.0},
    'anterior_deltoid': {'deltoid_anterior': 1.0},
    'lateral_deltoid': {'deltoid_lateral': 1.0},
    'posterior_deltoid': {'deltoid_posterior': 1.0},
    # Supraspinatus is not drawn (it lies under the trapezius); it abducts with the lateral deltoid.
    'supraspinatus': {'deltoid_lateral': 0.4},
    'infraspinatus_teres_minor': {'infraspinatus': 1.0, 'teres_minor': 0.8},
    # RepDB has no teres major; it extends and adducts the arm with the lats.
    'latissimus_dorsi': {'latissimus_dorsi_upper': 1.0, 'latissimus_dorsi_lower': 1.0, 'teres_major': 0.6},
    'rhomboids': {'rhomboids': 1.0},
    # Neutral split; the row, shrug and press rules shift it between the fibres.
    'trapezius': {'trapezius_upper': 1.0, 'trapezius_mid': 0.8, 'trapezius_lower': 0.5},
    'erector_spinae': {'erector_spinae_iliocostalis': 1.0, 'erector_spinae_longissimus': 1.0},
    # Quadratus lumborum is not drawn; iliocostalis lumborum is the visible column next to it.
    'quadratus_lumborum': {'erector_spinae_iliocostalis': 0.4},
    'biceps_brachii': {'biceps_brachii_long_head': 1.0, 'biceps_brachii_short_head': 1.0},
    'brachialis': {'brachialis': 1.0},
    'brachioradialis': {'brachioradialis': 1.0},
    'triceps_brachii': {'triceps_brachii_long_head': 1.0, 'triceps_brachii_lateral_head': 1.0,
                        'triceps_brachii_medial_head': 1.0, 'anconeus': 0.3},
    # Pronator teres pronates and only weakly flexes; the wrist flexors do the gripping.
    'forearm_flexors': {'wrist_flexor_group': 1.0, 'flexor_carpi_radialis': 1.0, 'pronator_teres': 0.5},
    'forearm_extensors': {'extensor_carpi_radialis': 1.0, 'extensor_digitorum': 1.0, 'extensor_carpi_ulnaris': 1.0},
    # RepDB's unspecific "forearms": mostly grip, so flexors first.
    'forearms': {'wrist_flexor_group': 1.0, 'flexor_carpi_radialis': 0.8, 'pronator_teres': 0.4,
                 'brachioradialis': 0.6, 'extensor_carpi_radialis': 0.6, 'extensor_digitorum': 0.6,
                 'extensor_carpi_ulnaris': 0.6},
    'rectus_abdominis': {'rectus_abdominis_upper': 1.0, 'rectus_abdominis_mid': 1.0, 'rectus_abdominis_lower': 1.0},
    # Transverse abdominis is not drawn; it lies under the internal oblique and blends into the lower abs.
    'transverse_abdominis': {'internal_oblique': 0.5, 'rectus_abdominis_lower': 0.3},
    'obliques': {'external_oblique': 1.0, 'internal_oblique': 0.8},
    # Vastus intermedius is not drawn.
    'quadriceps': {'rectus_femoris': 1.0, 'vastus_lateralis': 1.0, 'vastus_medialis': 1.0},
    # The short head of biceps femoris only flexes the knee; the hinge rules turn it down.
    'hamstrings': {'biceps_femoris_long_head': 1.0, 'biceps_femoris_short_head': 0.7,
                   'semitendinosus': 1.0, 'semimembranosus': 1.0},
    'gluteus_maximus': {'gluteus_maximus_upper': 1.0, 'gluteus_maximus_lower': 1.0},
    'gluteus_medius': {'gluteus_medius': 1.0},
    # Gluteus minimus is not drawn; TFL and the upper gluteus maximus fibres abduct with the medius.
    'abductors': {'gluteus_medius': 1.0, 'tensor_fasciae_latae': 0.8, 'gluteus_maximus_upper': 0.5},
    # Adductor brevis is not drawn.
    'adductors': {'adductor_magnus': 1.0, 'adductor_longus': 1.0, 'gracilis': 0.7, 'pectineus': 0.6},
    # Iliopsoas, the main hip flexor, is not drawn; the visible hip flexors take reduced shares.
    'hip_flexors': {'rectus_femoris': 0.7, 'sartorius': 0.5, 'tensor_fasciae_latae': 0.4, 'pectineus': 0.3},
    'gastrocnemius': {'gastrocnemius_medial': 1.0, 'gastrocnemius_lateral': 1.0},
    'soleus': {'soleus': 1.0},
    'tibialis_anterior': {'tibialis_anterior': 1.0},
}


# ─── Keyword rules ──────────────────────────────────────────────────────────────────────────────
class Rule:
    """Adjusts the weights of exercises whose name matches.

    muscles raises RepDB muscle weights before they are spread over parts. Then, on parts (a slug
    may be a part, a muscle or a map group): scale multiplies parts already present, floor raises
    to at least a value (adding the part if missing), cap lowers to at most a value, drop removes,
    only keeps just the listed slugs. Values are on the pre-normalisation scale, where a primary
    muscle is 1.0. Rules apply in list order, so later, more specific rules win.
    """

    def __init__(self, name, match, exclude=None, muscles=None, scale=None, floor=None, cap=None,
                 drop=(), only=()):
        self.name = name
        self.match = re.compile(match)
        self.exclude = re.compile(exclude) if exclude else None
        self.muscles = muscles or {}
        self.scale, self.floor, self.cap = scale or {}, floor or {}, cap or {}
        self.drop, self.only = drop, only

    def matches(self, name):
        return bool(self.match.search(name)) and not (self.exclude and self.exclude.search(name))


HAMS = 'biceps_femoris_long_head semitendinosus semimembranosus'.split()  # the hip-extending hamstrings
VASTI = ('vastus_lateralis', 'vastus_medialis')
BICEPS = 'biceps_brachii'
TRI_SHORT = ('triceps_brachii_lateral_head', 'triceps_brachii_medial_head')
GRIP = {'wrist_flexor_group': 0.3, 'flexor_carpi_radialis': 0.25}
STRETCH = r'stretch|\bpose\b|\bfold\b'


def each(slugs, value):
    return {s: value for s in slugs}


RULES = [
    # Chest: the bench angle moves work between the clavicular and abdominal heads.
    Rule('incline press or fly', r'\bincline\b.*\b(press|bench|fly|flye)\b|\blow[- ]to[- ]high\b',
         scale={'pectoralis_major_clavicular': 1.43, 'pectoralis_major_sternal': 0.85,
                'pectoralis_major_abdominal': 0.5, 'deltoid_anterior': 1.2},
         cap={'deltoid_anterior': 0.8}),
    Rule('decline press or fly', r'\bdecline\b.*\b(press|bench|fly|flye)\b|\bhigh[- ]to[- ]low\b.*\bfly',
         scale={'pectoralis_major_abdominal': 1.43, 'pectoralis_major_clavicular': 0.6, 'deltoid_anterior': 0.8}),
    Rule('feet-elevated push-up', r'\bdecline push-?ups?\b',  # pushes up and forward, like an incline press
         scale={'pectoralis_major_clavicular': 1.43, 'pectoralis_major_abdominal': 0.6, 'deltoid_anterior': 1.2}),
    Rule('hands-elevated push-up', r'\b(incline|wall) push-?ups?\b',
         scale={'pectoralis_major_abdominal': 1.3, 'pectoralis_major_clavicular': 0.75}),
    Rule('chest press', r'\b(bench|chest|floor|incline|decline|pin|spoto)\b.*\bpress\b|\bpush-?ups?\b|\bdips?\b',
         exclude=r'\b(leg|calf|pike|handstand|svend)\b',  # lateral delt barely works; long head of triceps less
         scale={'triceps_brachii_long_head': 0.75}, drop=('deltoid_lateral',)),
    Rule('push-up', r'\bpush-?ups?\b', exclude=r'\b(pike|handstand)\b',
         floor={'serratus_anterior': 0.3, 'rectus_abdominis': 0.2},
         cap={**each(TRI_SHORT, 0.65), 'triceps_brachii_long_head': 0.45, 'anconeus': 0.2}),
    Rule('chest dip', r'\bdips?\b', exclude=r'\b(bench|crab|plank|seated)\b|on bench',
         scale={'pectoralis_major_abdominal': 1.43, 'pectoralis_major_clavicular': 0.6},
         cap={'triceps_brachii_long_head': 0.7, 'rhomboids': 0.2}, floor={'latissimus_dorsi_lower': 0.2}),
    Rule('bench dip', r'\b(bench|crab|seated|reverse plank)\b.*\bdips?\b|\bdip hold on bench\b',
         scale={'triceps_brachii_long_head': 0.8}, floor={'deltoid_anterior': 0.5}),
    Rule('chest fly', r'\b(fly|flye|pec deck|crossover)\b', exclude=r'\b(reverse|rear|y-fly)\b',
         drop=('triceps_brachii', 'anconeus', 'serratus_anterior', 'deltoid_lateral', 'biceps_brachii_long_head'),
         cap={'biceps_brachii_short_head': 0.2, 'deltoid_anterior': 0.45}),
    Rule('close-grip press', r'\b(close[- ]grip|diamond|narrow[- ]grip)\b.*\b(press|bench|push-?ups?)\b',
         muscles={'triceps_brachii': 1.0, 'pectoralis_major': 0.8},
         floor={**each(TRI_SHORT, 1.0), 'triceps_brachii_long_head': 0.7, 'anconeus': 0.3},
         cap={'triceps_brachii_long_head': 0.7}),
    Rule('wide-grip press', r'\bwide[- ]grip\b.*\b(press|bench|push-?ups?)\b', scale={'triceps_brachii': 0.8}),
    Rule('pullover', r'\bpull-?over\b',  # shoulder extension: lats, lower pec, long head of triceps, serratus
         scale={'pectoralis_major_clavicular': 0.6, 'pectoralis_major_abdominal': 1.2},
         floor={'triceps_brachii_long_head': 0.4, 'teres_major': 0.6, 'serratus_anterior': 0.4},
         drop=TRI_SHORT + ('anconeus',)),
    Rule('svend press', r'\bsvend press\b', scale={'triceps_brachii': 0.6}),
    Rule('landmine press', r'\blandmine\b.*\bpress\b',
         floor={'pectoralis_major_clavicular': 0.8, 'serratus_anterior': 0.45}, scale={'pectoralis_major_abdominal': 0.5}),

    # Shoulders
    Rule('overhead press',
         r'\b(shoulder|overhead|military|arnold|push|bottoms-up|neck)\s+press\b|\bjerk\b|\b(pike|handstand) push-?ups?\b'
         r'|\bthruster\b|\b(clean|curl|lunge)( and)? press\b|\bwall ball\b',
         exclude=r'\b(leg|bench|chest|floor|pallof|svend|calf|landmine)\b',
         floor={'deltoid_lateral': 0.6, 'trapezius_upper': 0.35, 'serratus_anterior': 0.3,
                'pectoralis_major_clavicular': 0.25, **each(TRI_SHORT, 0.55), 'triceps_brachii_long_head': 0.4},
         cap={'deltoid_lateral': 0.75, 'trapezius_mid': 0.2, 'trapezius_lower': 0.25, 'pectoralis_major_sternal': 0.2},
         drop=('pectoralis_major_abdominal',)),
    Rule('behind-the-neck press', r'\bbehind[- ]the[- ]neck press\b',
         floor={'deltoid_lateral': 0.9, 'deltoid_posterior': 0.25}),
    Rule('lateral raise', r'\blateral raise\b|\bside raise\b|\by[- ]raise\b',
         floor={'deltoid_lateral': 1.0, 'deltoid_posterior': 0.2, 'serratus_anterior': 0.25, 'trapezius_upper': 0.35,
                'trapezius_mid': 0.2},
         cap={'deltoid_anterior': 0.35, 'trapezius_upper': 0.4, 'trapezius_mid': 0.2, 'trapezius_lower': 0.2},
         only=('deltoid', 'trapezius', 'serratus_anterior', 'infraspinatus', 'teres_minor')),
    Rule('front raise', r'\bfront raise\b',
         floor={'deltoid_anterior': 1.0, 'pectoralis_major_clavicular': 0.4, 'serratus_anterior': 0.25,
                'trapezius_upper': 0.25},
         cap={'deltoid_lateral': 0.35, 'pectoralis_major_sternal': 0.2, 'serratus_anterior': 0.3},
         drop=('pectoralis_major_abdominal',)),
    Rule('rear delt', r'\brear delt\b|\breverse (fly|flye|pec deck)\b|\bpull[- ]apart\b|\by-fly\b', exclude=STRETCH,
         floor={'deltoid_posterior': 1.0, 'trapezius_mid': 0.55, 'rhomboids': 0.5, 'trapezius_lower': 0.35,
                'infraspinatus': 0.4, 'teres_minor': 0.35, 'deltoid_lateral': 0.25},
         cap={'latissimus_dorsi': 0.4}, drop=('trapezius_upper',)),
    Rule('face pull', r'\bface pull\b',
         floor={'deltoid_posterior': 1.0, 'infraspinatus': 0.7, 'teres_minor': 0.6, 'trapezius_mid': 0.7,
                'trapezius_lower': 0.5, 'rhomboids': 0.6, 'deltoid_lateral': 0.3, BICEPS: 0.2},
         cap={'trapezius_upper': 0.3, 'deltoid_lateral': 0.35, BICEPS: 0.2, 'rhomboids': 0.6},
         drop=('deltoid_anterior',)),
    Rule('upright row', r'\bupright row\b|\bhigh pull\b',
         floor={'deltoid_lateral': 1.0, 'trapezius_upper': 0.85, BICEPS: 0.3, 'brachialis': 0.3, 'brachioradialis': 0.3},
         cap={'deltoid_anterior': 0.5, 'trapezius_mid': 0.4, 'trapezius_lower': 0.2, 'rhomboids': 0.25,
              BICEPS: 0.3}),
    Rule('shrug', r'\bshrugs?\b',
         floor={'trapezius_upper': 1.0, 'levator_scapulae': 0.55, **GRIP},
         cap={'trapezius_mid': 0.4, 'rhomboids': 0.25, 'deltoid': 0.3, 'forearm_flexors': 0.4},
         drop=('trapezius_lower',)),
    Rule('chest-supported shrug', r'\bchest[- ]supported shrug\b', floor={'trapezius_mid': 0.8, 'rhomboids': 0.5}),
    Rule('external rotation', r'\bexternal rotation\b',
         floor={'infraspinatus': 1.0, 'teres_minor': 0.8}, cap={'deltoid_posterior': 0.35}),

    # Back
    Rule('vertical pull', r'\bpull-?ups?\b|\bchin-?ups?\b|\bpull-?down\b|\bmuscle-?ups?\b|\brope climb\b|\bflexed arm hang\b',
         exclude=r'\bstraight[- ]arm\b|\bscapular\b',
         floor={'latissimus_dorsi_upper': 1.0, 'teres_major': 0.6, 'trapezius_lower': 0.4, BICEPS: 0.45,
                'brachialis': 0.4, 'brachioradialis': 0.3, 'pectoralis_major_abdominal': 0.2, 'trapezius_mid': 0.3,
                'deltoid_posterior': 0.3, 'wrist_flexor_group': 0.2, 'flexor_carpi_radialis': 0.2},
         cap={'rhomboids': 0.5, 'trapezius_mid': 0.4, 'trapezius_upper': 0.15, 'deltoid_posterior': 0.4, BICEPS: 0.8}),
    Rule('hanging grip', r'\bpull-?ups?\b|\bchin-?ups?\b|\bmuscle-?ups?\b|\bhang\b|\bhanging\b|\brope climb\b|\btoes to bar\b',
         floor=GRIP),
    Rule('wide-grip pull', r'\bwide[- ]grip\b.*\b(pull-?down|pull-?ups?)\b',
         floor={'latissimus_dorsi_upper': 1.0, 'teres_major': 0.8},
         scale={'latissimus_dorsi_lower': 0.85, BICEPS: 0.85}),
    Rule('close or neutral grip pull', r'\b(close[- ]grip|neutral[- ]grip|v-bar)\b.*\b(pull-?down|pull-?ups?|row)\b',
         floor={'latissimus_dorsi_lower': 1.0, 'brachialis': 0.55, 'brachioradialis': 0.4}),
    Rule('underhand pull', r'\b(reverse[- ]grip|underhand)\b.*\b(pull-?down|row)\b|\bchin-?ups?\b|\byates\b',
         floor={'latissimus_dorsi_lower': 1.0, BICEPS: 0.6}),
    Rule('behind-the-neck pull', r'\bbehind[- ]the[- ]neck\b.*\bpull', floor={'trapezius_mid': 0.5, 'rhomboids': 0.55,
                                                                            'deltoid_posterior': 0.45}),
    Rule('straight-arm pulldown', r'\bstraight[- ]arm\b',
         floor={'latissimus_dorsi_upper': 1.0, 'latissimus_dorsi_lower': 1.0, 'teres_major': 0.75,
                'triceps_brachii_long_head': 0.4, 'pectoralis_major_abdominal': 0.3, 'trapezius_lower': 0.3},
         cap={'deltoid_posterior': 0.35}, drop=TRI_SHORT + ('anconeus', BICEPS)),
    Rule('row', r'\brows?\b|\bbench pull\b', exclude=r'\b(upright|rear delt)\b',
         floor={'rhomboids': 0.7, 'trapezius_mid': 0.65, 'trapezius_lower': 0.45, 'teres_major': 0.5,
                'deltoid_posterior': 0.5, 'brachialis': 0.4, 'brachioradialis': 0.35, 'wrist_flexor_group': 0.25,
                'flexor_carpi_radialis': 0.2},
         cap={'trapezius_upper': 0.2, 'rhomboids': 0.85, 'trapezius_mid': 0.8, 'deltoid_posterior': 0.6, BICEPS: 0.5},
         scale={'latissimus_dorsi_lower': 0.9}),
    Rule('unsupported row', r'\b(bent[- ]over|pendlay|yates|t-bar)\b.*\brow\b',  # isometric hip hinge
         floor={'erector_spinae': 0.55, **each(HAMS, 0.25), 'gluteus_maximus_lower': 0.25, 'trapezius_upper': 0.3,
                **GRIP}),
    Rule('supported row', r'\b(chest[- ]supported|seated|machine|iso lateral|kneeling)\b.*\brow\b|\bbench pull\b',
         cap={'erector_spinae': 0.3}),
    Rule('wide-grip row', r'\bwide[- ]grip\b.*\brow\b',
         floor={'latissimus_dorsi_upper': 1.0, 'teres_major': 0.7, 'rhomboids': 0.85, 'trapezius_mid': 0.8,
                'deltoid_posterior': 0.65}, scale={'latissimus_dorsi_lower': 0.75}),
    Rule('high row', r'\bhigh row\b',  # pulls down and back from above: lats lead
         floor={'latissimus_dorsi_upper': 1.0, 'latissimus_dorsi_lower': 0.8, 'teres_major': 0.7, 'trapezius_lower': 0.5},
         cap={'rhomboids': 0.7, 'trapezius_mid': 0.6, 'trapezius_upper': 0.25, 'deltoid_posterior': 0.55}),
    Rule('low or single-arm row', r'\blow row\b|\b(single-arm|one[- ]arm)\b.*\brow\b',
         floor={'latissimus_dorsi_lower': 1.0}),

    # Hinges
    Rule('romanian deadlift', r'\b(romanian|rdl|stiff[- ]leg(ged)?|good morning|pull-through|single[- ]leg deadlift'
                              r'|kickstand deadlift|jefferson)\b',
         muscles={'hamstrings': 1.0, 'gluteus_maximus': 0.85},
         scale={'biceps_femoris_short_head': 0.3, 'gluteus_maximus_upper': 0.6},
         floor={'adductor_magnus': 0.55, 'erector_spinae': 0.55},
         drop=('rectus_femoris',) + VASTI),
    Rule('deadlift', r'\bdeadlift\b|\brack pull\b',
         exclude=r'\b(romanian|rdl|stiff[- ]leg(ged)?|single[- ]leg|kickstand)\b',
         scale={'biceps_femoris_short_head': 0.4, 'gluteus_maximus_upper': 0.65, 'rectus_femoris': 0.5,
                **each(HAMS, 0.8)},
         floor={'erector_spinae': 0.8, 'adductor_magnus': 0.6, **each(VASTI, 0.5), 'trapezius_upper': 0.45,
                'trapezius_mid': 0.35, 'latissimus_dorsi': 0.3, 'wrist_flexor_group': 0.5,
                'flexor_carpi_radialis': 0.45, 'rectus_abdominis': 0.2}),
    Rule('loaded hinge grip', r'\b(romanian|rdl|stiff[- ]leg(ged)?|deadlift|rack pull)\b', exclude=r'\b(band|hold)\b',
         floor={**GRIP, 'trapezius_upper': 0.25, 'trapezius_mid': 0.2, 'latissimus_dorsi': 0.2}),
    Rule('swing', r'\bswings?\b', exclude=r'\bleg swing\b',  # ballistic hip hinge
         scale={'gluteus_maximus_upper': 0.65, 'biceps_femoris_short_head': 0.35},
         floor={'adductor_magnus': 0.5, 'rectus_abdominis': 0.25, 'wrist_flexor_group': 0.4, 'flexor_carpi_radialis': 0.35},
         cap={**each(VASTI, 0.3), 'rectus_femoris': 0.2}),
    Rule('trap bar', r'\b(trap|hex) bar\b', floor=each(VASTI, 0.85), scale=each(HAMS, 0.7)),
    Rule('sumo', r'\bsumo\b', floor={'adductor_magnus': 0.75, 'adductor_longus': 0.55, 'gracilis': 0.35,
                                     **each(VASTI, 0.65)}),

    # Squats and lunges
    Rule('squat or leg press', r'\bsquat\b|\bleg press\b|\bwall sit\b|\bthruster\b|\bwall ball\b',
         exclude=STRETCH + r'|\bcalf\b|\bsissy\b|\bsplit squat\b|\bbulgarian\b|\bpistol\b|\bshrimp\b|\bcossack\b',
         scale={'rectus_femoris': 0.6, 'gluteus_maximus_upper': 0.6, 'biceps_femoris_short_head': 0.3},
         floor={'adductor_magnus': 0.55, 'gluteus_medius': 0.25},
         cap={**each(HAMS, 0.3), 'erector_spinae': 0.5, 'gastrocnemius': 0.2, 'soleus': 0.25}),
    Rule('machine squat', r'\bleg press\b|\bhack squat\b', exclude=r'\bbarbell\b|\bcalf\b',
         drop=('erector_spinae',), cap={'gluteus_medius': 0.2}),
    Rule('quad-biased squat', r'\b(front|goblet|zercher|heel-elevated|hack|safety bar)\b.*\bsquat\b|\bclose-stance\b',
         scale={'gluteus_maximus_lower': 0.8, 'gluteus_maximus_upper': 0.8}),
    Rule('glute-biased squat', r'\b(box|wide-stance|high-foot)\b.*\b(squat|leg press)\b',
         floor={'gluteus_maximus_lower': 1.0}, scale=each(VASTI, 0.85)),
    Rule('lunge or split squat', r'\blunges?\b|\bsplit squat\b|\bstep[- ]?ups?\b|\bpistol\b|\bcossack\b|\bshrimp squat\b',
         exclude=STRETCH + r'|\b(low|crescent|revolved)\b',
         scale={'rectus_femoris': 0.6, 'gluteus_maximus_upper': 0.6, 'biceps_femoris_short_head': 0.3},
         floor={'gluteus_maximus_lower': 0.9, 'gluteus_medius': 0.45, 'adductor_magnus': 0.5},
         cap={**each(HAMS, 0.35), 'erector_spinae': 0.3}),
    Rule('leg extension', r'\bleg extension\b|\bterminal knee extension\b|\bsissy squat\b|\breverse nordic\b',
         floor={'rectus_femoris': 1.0, 'vastus_lateralis': 1.0, 'vastus_medialis': 1.0},
         only=('rectus_femoris', 'vastus_lateralis', 'vastus_medialis')),
    Rule('leg curl', r'\bleg curl\b|\bhamstring curl\b|\bnordic\b|\bglute ham raise\b', exclude=r'\breverse nordic\b',
         muscles={'hamstrings': 1.0},
         floor={'biceps_femoris_short_head': 1.0, 'gracilis': 0.25, 'sartorius': 0.2, 'gastrocnemius': 0.25},
         cap={'gastrocnemius': 0.3}),
    Rule('machine leg curl', r'\b(seated|lying|machine|standing)\b.*\bleg curl\b', drop=('gluteus_maximus',)),

    # Glutes and hips
    Rule('hip thrust or bridge', r'\bhip thrust\b|\bglute bridge\b|\bhip bridge\b|\bglute drive\b|\bhip pulses\b',
         muscles={'gluteus_maximus': 1.0},
         floor={'gluteus_maximus_upper': 0.85, 'gluteus_medius': 0.35, 'adductor_magnus': 0.35, **each(VASTI, 0.25)},
         cap={'gluteus_medius': 0.5, **each(HAMS, 0.4), **each(VASTI, 0.3), 'erector_spinae': 0.25},
         drop=('biceps_femoris_short_head', 'rectus_femoris')),
    Rule('glute kickback', r'\bglute kickback\b|\bdonkey kick',
         floor={'gluteus_maximus_upper': 0.7, 'gluteus_medius': 0.3}, cap=each(HAMS, 0.4),
         drop=('erector_spinae', 'biceps_femoris_short_head')),
    Rule('hip abduction', r'\babduction\b|\bclamshells?\b|\bfire hydrant\b|\blateral walk\b|\bside kick\b',
         exclude=STRETCH,
         floor={'gluteus_medius': 1.0, 'gluteus_maximus_upper': 0.6, 'tensor_fasciae_latae': 0.5},
         cap={'gluteus_maximus_lower': 0.3, 'quads': 0.2}),
    Rule('seated hip abduction', r'\b(seated|machine)\b.*\babduction\b', floor={'gluteus_maximus_upper': 0.8}),
    Rule('hip adduction', r'\badduction\b|\bcopenhagen\b', exclude=STRETCH,
         floor={'adductor_magnus': 1.0, 'adductor_longus': 1.0, 'gracilis': 0.7, 'pectineus': 0.6}),
    Rule('isolated adduction', r'\b(machine|band|side lying|side-lying)\b.*\badduction\b', only=('adductors',)),

    # Calves
    Rule('standing calf raise', r'\bcalf (raise|press)\b|\bheel raise\b', exclude=r'\bseated\b',
         floor={'gastrocnemius': 1.0, 'soleus': 0.6, 'peroneus_longus': 0.2},
         cap={'soleus': 0.7, 'forearm_flexors': 0.2}),
    Rule('seated calf raise', r'\bseated calf\b',
         floor={'soleus': 1.0, 'peroneus_longus': 0.2}, cap={'gastrocnemius': 0.3}),
    Rule('tibialis raise', r'\btibialis\b|\btoe raise\b', only=('tibialis_anterior',)),

    # Core
    Rule('crunch', r'\bcrunch(es)?\b|\bsit-?ups?\b|\bjackknife\b', exclude=r'\b(reverse|bicycle|cross-body)\b',
         scale={'rectus_abdominis_lower': 0.75}),
    Rule('leg raise', r'\b(leg|knee) raises?\b|\bknee tucks?\b|\breverse crunch|\btoes to bar\b|\bl[- ]sit\b|\bv-ups?\b'
                      r'|\bv-sit\b|\b(flutter|scissor) kicks?\b|\bsix inch\b|\bdragon flag\b|\bleg pull-in\b'
                      r'|\bhanging (pike|tuck)\b|\bdead bug\b',
         scale={'rectus_abdominis_upper': 0.6, 'rectus_abdominis_mid': 0.85},
         floor={'rectus_abdominis_lower': 1.0}),
    Rule('rotation or side bend', r'\btwists?\b|\bwood ?chop\b|\brotary\b|\bwindshield\b|\bside bend\b|\bheel touch'
                                  r'|\bbicycle crunch\b|\bcross-body crunch\b|\bpallof\b|\bside plank\b|\bsuitcase\b'
                                  r'|\bwindmills?\b|\bside throw\b',
         scale={'internal_oblique': 1.25, 'rectus_abdominis': 0.6}),
    Rule('plank', r'\bplank\b', exclude=r'\b(side|reverse|copenhagen)\b',  # anti-extension
         floor={'external_oblique': 0.5, 'internal_oblique': 0.55, 'serratus_anterior': 0.3, 'deltoid_anterior': 0.3},
         cap={'erector_spinae': 0.25}),
    Rule('dead hang', r'\bdead hang\b',
         floor={'trapezius_lower': 0.3, 'brachioradialis': 0.3},
         cap={'latissimus_dorsi': 0.35, 'teres_major': 0.25, 'trapezius_upper': 0.2, 'trapezius_mid': 0.2,
              'rectus_abdominis': 0.2, 'pronator_teres': 0.2}),
    Rule('back extension', r'\bback extension\b|\bhyperextension\b|\bsuperman\b|\breverse hyper',
         scale={'biceps_femoris_short_head': 0.3}, floor={'gluteus_maximus_lower': 0.5, 'adductor_magnus': 0.35}),

    # Arms
    Rule('curl', r'\bcurls?\b', exclude=r'\b(leg|wrist|hamstring|nordic|jefferson|stability ball)\b',
         floor={'brachialis': 0.55, 'brachioradialis': 0.35, 'wrist_flexor_group': 0.2, 'flexor_carpi_radialis': 0.2},
         cap={'deltoid_anterior': 0.2, 'forearm_flexors': 0.3}),
    Rule('strict curl', r'\bcurls?\b', exclude=r'\b(cheat|leg|wrist|hamstring|nordic|jefferson|stability ball)\b',
         drop=('erector_spinae',)),
    Rule('long-head curl', r'\bincline\b.*\bcurl\b|\bbayesian\b|\bdrag curl\b',
         scale={'biceps_brachii_short_head': 0.8}),
    Rule('short-head curl', r'\b(preacher|spider|concentration)\b',
         scale={'biceps_brachii_long_head': 0.85}, floor={'brachialis': 0.7}),
    Rule('hammer curl', r'\bhammer\b|\bneutral[- ]grip curl\b|\brope curl\b',
         floor={'brachialis': 1.0, 'brachioradialis': 1.0, 'extensor_carpi_radialis': 0.3},
         cap={'biceps_brachii_long_head': 0.7, 'biceps_brachii_short_head': 0.55}),
    Rule('reverse curl', r'\breverse curl\b',  # pronated: brachioradialis leads, wrist extensors hold the wrist
         floor={'brachioradialis': 1.0, 'brachialis': 0.9, 'extensor_carpi_radialis': 0.65,
                'extensor_digitorum': 0.4, 'extensor_carpi_ulnaris': 0.3, 'pronator_teres': 0.25},
         cap={BICEPS: 0.4, 'extensor_carpi_radialis': 0.65, 'extensor_digitorum': 0.4, 'extensor_carpi_ulnaris': 0.3,
              'pronator_teres': 0.25},
         drop=('wrist_flexor_group', 'flexor_carpi_radialis')),
    Rule('zottman curl', r'\bzottman\b', floor={'brachioradialis': 0.8, 'extensor_carpi_radialis': 0.5}),
    Rule('wrist curl', r'\bwrist curl\b', exclude=r'\breverse\b',
         floor={'wrist_flexor_group': 1.0, 'flexor_carpi_radialis': 1.0},
         only=('wrist_flexor_group', 'flexor_carpi_radialis')),
    Rule('reverse wrist curl', r'\breverse wrist curl\b|\bwrist extension\b',
         floor={'extensor_carpi_radialis': 1.0, 'extensor_digitorum': 0.8, 'extensor_carpi_ulnaris': 0.8,
                'brachioradialis': 0.25},
         cap={'brachioradialis': 0.25},
         only=('forearm_extensors', 'brachioradialis')),
    Rule('triceps extension', r'\btri(cep|ceps)?\b.*\b(extension|pushdown|push-down|kickback)\b|\bskull ?crusher\b'
                              r'|\bpush-?down\b|\bjm press\b|\btate press\b',
         exclude=STRETCH + r'|\bdip\b',
         floor={'anconeus': 0.3}, cap={'deltoid_posterior': 0.2, 'external_oblique': 0.2, 'internal_oblique': 0.2},
         drop=('deltoid_anterior', 'forearm_extensors', 'forearms', 'latissimus_dorsi')),
    Rule('overhead triceps extension', r'\boverhead\b.*\btri|\bseated tricep extension\b',
         scale={'triceps_brachii_lateral_head': 0.8, 'triceps_brachii_medial_head': 0.8}),
    Rule('pushdown or kickback', r'\bpush-?down\b|\bkickback\b', exclude=r'\bglute\b',
         scale={'triceps_brachii_long_head': 0.7}),
    Rule('lying triceps extension', r'\blying tri|\bskull ?crusher\b', scale=each(TRI_SHORT, 0.9)),
    Rule('reverse-grip triceps', r'\breverse[- ]grip tri', scale={'triceps_brachii_long_head': 0.6,
                                                                 'triceps_brachii_lateral_head': 0.9}),

    # Carries: grip and trunk hold the load; the legs only walk
    Rule('carry', r'\bfarmer|\bcarry\b|\bsuitcase\b',
         floor={'gluteus_medius': 0.3},
         cap={'quads': 0.3, 'gluteus_maximus': 0.35, 'rectus_abdominis': 0.35, 'trapezius_mid': 0.5,
              'trapezius_lower': 0.3, 'pronator_teres': 0.3}),

    # Neck
    Rule('neck flexion', r'\bneck (lateral flexion|side|flexion|extension)\b',
         floor={'sternocleidomastoid': 1.0, 'levator_scapulae': 0.8},
         cap={'trapezius_upper': 0.8, 'trapezius_mid': 0.2}, drop=('trapezius_lower', 'rhomboids')),
]


# ─── Building the rows ──────────────────────────────────────────────────────────────────────────
def check_vocabulary(vocab):
    """Every slug used above must exist in the map, so a map change fails loudly."""
    for muscle, shares in BASE.items():
        for part in shares:
            if part not in vocab.part_of:
                raise SystemExit(f'BASE[{muscle}]: "{part}" is not a part of {vocab.map_id}')
    for rule in RULES:
        for m in rule.muscles:
            if m not in BASE:
                raise SystemExit(f'rule "{rule.name}": "{m}" is not a RepDB muscle in BASE')
        for slug in [*rule.scale, *rule.floor, *rule.cap, *rule.drop, *rule.only]:
            try:
                vocab.expand(slug)
            except ValueError as e:
                raise SystemExit(f'rule "{rule.name}": {e}')


def normalise(parts):
    top = max(parts.values())
    out = {}
    for part, v in parts.items():
        w = (Decimal(str(v)) / Decimal(str(top))).quantize(CENT, rounding=ROUND_HALF_UP)
        if w >= MIN_WEIGHT:
            out[part] = w
    return out


def rule_regions(ex, vocab, trace=None):
    name = ex['name'].lower()
    rules = [r for r in RULES if r.matches(name)]
    if trace is not None:
        trace.extend(r.name for r in rules)
    muscles = {t['muscle']: float(t['weight']) for t in ex['targets'] if float(t['weight']) > 0}
    for r in rules:
        for m, w in r.muscles.items():
            muscles[m] = max(muscles.get(m, 0.0), w)
    parts = {}
    for m, w in muscles.items():
        for part, share in BASE[m].items():
            parts[part] = max(parts.get(part, 0.0), w * share)
    for r in rules:
        for slug, f in r.scale.items():
            for p in vocab.expand(slug):
                if p in parts:
                    parts[p] *= f
        for slug, v in r.floor.items():
            for p in vocab.expand(slug):
                parts[p] = max(parts.get(p, 0.0), v)
        for slug, v in r.cap.items():
            for p in vocab.expand(slug):
                if p in parts:
                    parts[p] = min(parts[p], v)
        for slug in r.drop:
            for p in vocab.expand(slug):
                parts.pop(p, None)
        if r.only:
            keep = {p for slug in r.only for p in vocab.expand(slug)}
            parts = {p: v for p, v in parts.items() if p in keep}
    return normalise(parts) if parts else {}


def hand_regions(catalog_id, entry, vocab):
    """Override weights as written, with muscle slugs expanded to their parts."""
    out = {}
    for slug, w in entry['regions'].items():
        if slug in vocab.non_muscle or not vocab.is_region(slug):
            raise SystemExit(f'region_overrides.json {catalog_id}: "{slug}" is not a muscle part or muscle of {vocab.map_id}')
        for part in vocab.expand(slug):
            if part in out:
                raise SystemExit(f'region_overrides.json {catalog_id}: {part} is given twice')
            out[part] = Decimal(str(w)).quantize(CENT)
            if out[part] != Decimal(str(w)):
                raise SystemExit(f'region_overrides.json {catalog_id}: {slug} {w} has more than two decimals')
    return out


def our_names():
    """Our own name for each catalog row we had before the RepDB import (never a RepDB name)."""
    with open(os.path.join(HERE, 'decisions.json')) as f:
        return {r['id']: r.get('new_name') or r['name'] for r in json.load(f)['rows']}


def check_override_names(overrides):
    """The readable name in an override must be our own name, so no RepDB name is committed."""
    names = our_names()
    errors = []
    for catalog_id, entry in overrides['exercises'].items():
        if 'name' in entry and entry['name'] != names.get(catalog_id):
            errors.append(f'{catalog_id}: name "{entry["name"]}" is not our own name for the row '
                          f'(decisions.json: {names.get(catalog_id)!r}); use repdb_id for RepDB rows')
    return errors


def build(catalog, overrides, vocab):
    """catalog_id -> (source, {part: weight})."""
    exempt = overrides.get('no_targets', {})
    hand = overrides['exercises']
    out = {}
    for catalog_id, ex in sorted(catalog.items()):
        if catalog_id in exempt:
            continue
        if catalog_id in hand:
            out[catalog_id] = ('hand', hand_regions(catalog_id, hand[catalog_id], vocab))
        else:
            regions = rule_regions(ex, vocab)
            if regions:
                out[catalog_id] = ('rule', regions)
    for catalog_id in hand:
        if catalog_id not in catalog:
            raise SystemExit(f'region_overrides.json: {catalog_id} is not in the catalog')
    return out


def sorted_regions(regions):
    return sorted(regions.items(), key=lambda kv: (-kv[1], kv[0]))


def render_seed(built, map_id, vocab):
    n_rows = sum(len(r) for _, r in built.values())
    n_hand = sum(1 for s, _ in built.values() if s == 'hand')
    q = map_id.replace("'", "''")
    values = []
    for catalog_id, (source, regions) in sorted(built.items()):
        js = '{' + ','.join(f'"{p}":{w}' for p, w in sorted_regions(regions)) + '}'
        values.append(f"  ('{catalog_id}', '{source}', '{js}')")
    commit = f' (hierarchy.ts as of commit {vocab.commit[:7]})' if vocab.commit else ''
    return '\n'.join([
        f'-- {len(built)} exercises ({n_hand} hand, {len(built) - n_hand} rule), {n_rows} rows, map {map_id}{commit}.',
        'create temp table _region_seed (catalog_id text primary key, source text not null, regions jsonb not null)',
        '  on commit drop;',
        'insert into _region_seed (catalog_id, source, regions) values',
        ',\n'.join(values) + ';',
        '',
        'insert into public.exercise_region_targets (catalog_id, map_id, region, weight, source)',
        f"select s.catalog_id, '{q}', r.key, r.value::numeric(3,2), s.source",
        'from _region_seed s',
        'join public.exercises_catalog c on c.id = s.catalog_id',
        'cross join lateral jsonb_each_text(s.regions) r',
        'on conflict (catalog_id, map_id, region) do update',
        '  set weight = excluded.weight, source = excluded.source',
        '  where (exercise_region_targets.weight, exercise_region_targets.source)',
        '        is distinct from (excluded.weight, excluded.source);',
        '',
        '-- Rows of this map_id that are no longer generated.',
        'delete from public.exercise_region_targets t',
        f"where t.map_id = '{q}'",
        '  and not exists (select 1 from _region_seed s where s.catalog_id = t.catalog_id and s.regions ? t.region);',
    ])


def write_migration(path, block):
    with open(path) as f:
        text = f.read()
    start, end = text.find(MARK_BEGIN), text.find(MARK_END)
    if start < 0 or end < start:
        raise SystemExit(f'{path}: markers "{MARK_BEGIN}" / "{MARK_END}" not found')
    start = text.index('\n', start) + 1
    with open(path, 'w') as f:
        f.write(text[:start] + block + '\n' + text[end:])


def print_coverage(catalog, built, overrides):
    linked = sum(c['uses'] for c in catalog.values())
    hand_ids = [i for i, (s, _) in built.items() if s == 'hand']
    hand_uses = sum(catalog[i]['uses'] for i in hand_ids)
    visible = [i for i, c in catalog.items() if not c['hidden']]
    logged = sorted((i for i, c in catalog.items() if c['uses']), key=lambda i: -catalog[i]['uses'])
    top = logged[:TOP_N]
    missing = [i for i in top if i not in hand_ids]
    print(f'catalog: {len(catalog)} rows, {len(visible)} visible, {len(logged)} ever logged')
    print(f'seeded: {len(built)} exercises ({sum(1 for i in visible if i in built)} visible), '
          f'{sum(len(r) for _, r in built.values())} rows; no targets by design: {len(overrides.get("no_targets", {}))}')
    print(f'hand-tuned: {len(hand_ids)} exercises, covering {hand_uses} of {linked} logged exercise rows '
          f'linked to the catalog ({100 * hand_uses / max(linked, 1):.1f}%)')
    print(f'top {TOP_N} most-logged: ' + ('all hand-tuned' if not missing else
                                         f'{len(missing)} not hand-tuned, e.g. {", ".join(missing[:5])}'))
    return missing


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--db', required=True, metavar='DATABASE_URL', help='read only: catalog, muscle targets, usage')
    ap.add_argument('--map', default=DEFAULT_MAP, metavar='DIR', help='momentum-muscle-map checkout (default: %(default)s)')
    ap.add_argument('--migration', metavar='FILE', help='migration whose GENERATED SEED block to rewrite')
    ap.add_argument('--psql', default=os.environ.get('PSQL', 'psql'))
    ap.add_argument('--show', nargs='+', metavar='ID_OR_NAME', help='print the weights of these exercises')
    ap.add_argument('--compare', action='store_true', help='print rule weights next to the hand weights')
    args = ap.parse_args()

    overrides = load_overrides()
    vocab = MapVocab(args.map)
    if vocab.map_id != overrides['map_id']:
        raise SystemExit(f'{args.map} is {vocab.map_id} but region_overrides.json is for {overrides["map_id"]}')
    check_vocabulary(vocab)
    catalog = load_catalog(args.psql, args.db)
    built = build(catalog, overrides, vocab)

    rows = [(i, p, w, s) for i, (s, regions) in built.items() for p, w in regions.items()]
    errors = check_override_names(overrides) + validate(rows, catalog, vocab, set(overrides.get('no_targets', {})))
    missing = print_coverage(catalog, built, overrides)

    if args.show:
        by_name = {c['name']: i for i, c in catalog.items()}
        for key in args.show:
            catalog_id = by_name.get(key, key)
            if catalog_id not in built:
                print(f'\n{key}: no regions')
                continue
            source, regions = built[catalog_id]
            print(f'\n{catalog[catalog_id]["name"]} ({catalog_id}, {source})')
            for p, w in sorted_regions(regions):
                print(f'  {w}  {p}')
    if args.compare:
        total = 0.0
        for catalog_id, entry in sorted(overrides['exercises'].items(), key=lambda kv: catalog[kv[0]]['name']):
            hand, trace = built[catalog_id][1], []
            rule = rule_regions(catalog[catalog_id], vocab, trace)
            keys = set(hand) | set(rule)
            diff = sum(abs(float(hand.get(k, 0)) - float(rule.get(k, 0))) for k in keys) / len(keys)
            total += diff
            print(f'{diff:.2f}  {catalog[catalog_id]["name"]}  [{", ".join(trace)}]')
            for k in sorted(keys, key=lambda k: -float(hand.get(k, 0))):
                if abs(float(hand.get(k, 0)) - float(rule.get(k, 0))) >= 0.2:
                    print(f'        {k}: hand {hand.get(k, "-")}  rule {rule.get(k, "-")}')
        print(f'mean |hand - rule| per region: {total / len(overrides["exercises"]):.3f}')

    if errors or missing:
        for e in errors:
            print('  ' + e, file=sys.stderr)
        raise SystemExit('FAILED: fix the problems above; nothing was written')
    print('OK: all checks passed')
    if args.migration:
        write_migration(args.migration, render_seed(built, overrides['map_id'], vocab))
        print(f'wrote the seed block of {args.migration}')


if __name__ == '__main__':
    main()
