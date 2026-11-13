"""Equipment-first exercise names, stored lowercase like the rest of the catalog.

    name_for("Upright Row", "barbell")                        -> "barbell upright row"
    name_for("Close Grip Barbell Curl", "barbell")            -> "barbell close grip curl"
    name_for("Chin Ups", "pull_up_bar")                       -> "chin-ups"            (bodyweight: no prefix)
    name_for("Seated Leg Press", "leg_press")                 -> "seated leg press"    (dedicated machine)
    name_for("Shoulder Press Machine", "shoulder_press_machine") -> "machine shoulder press"

`equipment` uses RepDB's equipment ids (None = bodyweight).
"""
import re

EQUIP_LABEL = {
    'barbell': 'barbell', 'dumbbell': 'dumbbell', 'kettlebell': 'kettlebell', 'cable': 'cable',
    'smith_machine': 'smith machine', 'ez_bar': 'ez-bar', 'trap_bar': 'trap bar',
    'resistance_band': 'band', 'loop_band': 'band', 'suspension_trainer': 'trx', 'rings': 'ring',
    'plates': 'plate', 'sled': 'sled', 'medicine_ball': 'medicine ball', 'stability_ball': 'stability ball',
    'bosu_ball': 'bosu', 'landmine': 'landmine', 'battle_rope': 'battle rope',
}
SYN = [('hex bar', 'trap bar'), ('ez bar', 'ez-bar'), ('db ', 'dumbbell '),
       ('one arm', 'single-arm'), ('one-arm', 'single-arm'), ('single arm', 'single-arm')]
# "pull ups" -> "pull-ups", "sit ups" -> "sit-ups", ...
UPS = re.compile(r'\b(pull|push|chin|sit|step|get|muscle|v) ups\b')
# Equipment that never gets a prefix: bodyweight stations and gym furniture.
NO_PREFIX = (None, 'pull_up_bar', 'dip_station', 'flat_bench', 'plyo_box', 'jump_rope', 'climbing_rope',
             'wall_ball', 'glute_ham_developer')
# Cardio machines keep their own name.
CARDIO = ('rower', 'ski_erg', 'treadmill', 'stair_climber', 'air_bike', 'assault_bike', 'stationary_bike',
          'elliptical', 'bicycle')
DEDICATED = ('leg press', 'hack squat', 'pec deck', 'leg curl', 'leg extension')
BAND_EQUIPMENT = ('resistance_band', 'loop_band')


def is_machine(eq):
    return bool(eq) and (eq.endswith('_machine') or eq in ('leg_press', 'leg_curl', 'leg_extension',
                                                            'hack_squat', 'pec_deck'))


def _normalise(raw):
    n = raw.lower().replace('’', "'").strip()
    for a, b in SYN:
        n = n.replace(a, b)
    n = UPS.sub(r'\1-ups', ' '.join(n.split()))
    return n


def name_for(raw, eq):
    n = _normalise(raw)
    label = EQUIP_LABEL.get(eq)
    if label is None:
        if eq in CARDIO or eq in NO_PREFIX or not is_machine(eq):
            return n
        if n.endswith(' machine'):                       # "x machine" -> "machine x"
            return 'machine ' + n[:-len(' machine')]
        if n.startswith('machine ') or any(w in n for w in DEDICATED):
            return n
        if ' machine ' in f' {n} ':                       # "x machine y" -> "machine x y"
            return 'machine ' + ' '.join(f' {n} '.replace(' machine ', ' ', 1).split())
        return 'machine ' + n
    if eq in BAND_EQUIPMENT and n.startswith('banded '):  # "banded x" -> "band x"
        n = n[len('banded '):]
    if n.startswith(label + ' ') or n == label + 's' or n.startswith(label + 's '):
        return n                                          # already starts with the (plural) label
    head = label.split()[-1]
    if ' ' in label and n.startswith(head + ' '):         # "ball x" -> "stability ball x"
        return label + n[len(head):]
    if f' {label} ' in f' {n} ':                          # move the equipment word to the front
        n = ' '.join(f' {n} '.replace(f' {label} ', ' ', 1).split())
    return f'{label} {n}'
