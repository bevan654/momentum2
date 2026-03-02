import React, { useCallback, useMemo } from "react";
import { Path } from "react-native-svg";
import differenceWith from "ramda/src/differenceWith";

import { bodyFront } from "./assets/bodyFront";
import { bodyBack } from "./assets/bodyBack";
import { SvgMaleWrapper } from "./components/SvgMaleWrapper";
import { bodyFemaleFront } from "./assets/bodyFemaleFront";
import { bodyFemaleBack } from "./assets/bodyFemaleBack";
import { SvgFemaleWrapper } from "./components/SvgFemaleWrapper";

export type Slug =
  | "abs"
  | "adductors"
  | "ankles"
  | "biceps"
  | "calves"
  | "chest"
  | "deltoids"
  | "feet"
  | "forearm"
  | "gluteal"
  | "hamstring"
  | "hands"
  | "hair"
  | "head"
  | "knees"
  | "lower-back"
  | "neck"
  | "obliques"
  | "quadriceps"
  | "rear-deltoids"
  | "tibialis"
  | "trapezius"
  | "triceps"
  | "upper-back";

export interface BodyPart {
  color?: string;
  slug?: Slug;
  path?: {
    common?: string[];
    left?: string[];
    right?: string[];
  };
}

export interface ExtendedBodyPart extends BodyPart {
  intensity?: number;
  side?: "left" | "right";
}

export type BodyProps = {
  colors?: ReadonlyArray<string>;
  data: ReadonlyArray<ExtendedBodyPart>;
  scale?: number;
  side?: "front" | "back";
  gender?: "male" | "female";
  onBodyPartPress?: (b: ExtendedBodyPart, side?: "left" | "right") => void;
  border?: string | "none";
  backColor?: string;
};

const comparison = (a: ExtendedBodyPart, b: ExtendedBodyPart) =>
  a.slug === b.slug;

const Body = ({
  colors = ["#0984e3", "#74b9ff"],
  data,
  scale = 1,
  side = "front",
  gender = "male",
  onBodyPartPress,
  border = "#dfdfdf",
  backColor = "#3f3f3f",
}: BodyProps) => {
  const mergedBodyParts = useCallback(
    (dataSource: ReadonlyArray<BodyPart>) => {
      const innerData = data
        .map((d) => {
          let foundedBodyPart = dataSource.find((e) => e.slug === d.slug);
          return foundedBodyPart;
        })
        .filter(Boolean);

      const coloredBodyParts = innerData.map((d) => {
        const bodyPart = data.find((e) => e.slug === d?.slug);
        let colorIntensity = 1;
        if (bodyPart?.intensity) colorIntensity = bodyPart.intensity;
        return { ...d, color: colors[colorIntensity - 1] };
      });

      const formattedBodyParts = differenceWith(comparison, dataSource, data)
        .map(bp => ({ ...bp, color: backColor }));

      return [...formattedBodyParts, ...coloredBodyParts];
    },
    [data, colors, backColor]
  );

  const getColorToFill = useCallback(
    (bodyPart: ExtendedBodyPart) => bodyPart.color || backColor,
    [backColor]
  );

  const bodyToRender = useMemo(() => {
    if (gender === "female") {
      return side === "front" ? bodyFemaleFront : bodyFemaleBack;
    }
    return side === "front" ? bodyFront : bodyBack;
  }, [gender, side]);

  const mergedParts = useMemo(
    () => mergedBodyParts(bodyToRender),
    [mergedBodyParts, bodyToRender]
  );

  const SvgWrapper = gender === "male" ? SvgMaleWrapper : SvgFemaleWrapper;

  return (
    <SvgWrapper side={side} scale={scale} border={border}>
      {mergedParts.map((bodyPart: ExtendedBodyPart) => {
        const dataEntry = data.find((d) => d.slug === bodyPart.slug);

        const commonPaths = (bodyPart.path?.common || []).map((path) => (
          <Path
            key={path}
            onPress={() => onBodyPartPress?.(bodyPart)}
            id={bodyPart.slug}
            fill={dataEntry?.path?.common ? getColorToFill(bodyPart) : bodyPart.color || backColor}
            d={path}
          />
        ));

        const leftPaths = (bodyPart.path?.left || []).map((path) => (
          <Path
            key={path}
            onPress={() => onBodyPartPress?.(bodyPart, "left")}
            id={bodyPart.slug}
            fill={dataEntry?.side === "right" ? backColor : getColorToFill(bodyPart)}
            d={path}
          />
        ));

        const rightPaths = (bodyPart.path?.right || []).map((path) => (
          <Path
            key={path}
            onPress={() => onBodyPartPress?.(bodyPart, "right")}
            id={bodyPart.slug}
            fill={dataEntry?.side === "left" ? backColor : getColorToFill(bodyPart)}
            d={path}
          />
        ));

        return <React.Fragment key={bodyPart.slug}>{commonPaths}{leftPaths}{rightPaths}</React.Fragment>;
      })}
    </SvgWrapper>
  );
};

export default React.memo(Body);
