import {
  EXPERIMENTAL_ULTIMATES,
  getExperimentalUltimate,
  isExperimentalUltimateId,
  resolveExperimentalUltimate,
  type ExperimentalResolutionInput,
  type ExperimentalResolutionResult,
  type ExperimentalUltimateDefinition,
  type ExperimentalUltimateId,
} from "./experimental-ultimates";
import {
  VFX_LAB_II_IDS,
  VFX_LAB_II_WEAPONS,
  getVfxLabWeapon,
  isVfxLabWeaponId,
  resolveVfxLabWeapon,
  type VfxLabResolutionInput,
  type VfxLabResolutionResult,
  type VfxLabWeaponDefinition,
  type VfxLabWeaponId,
} from "./experimental-vfx-lab-ii";

export const EXPERIMENTAL_SHOWCASE_IDS = [
  ...EXPERIMENTAL_ULTIMATES.map(({ id }) => id),
  ...VFX_LAB_II_IDS,
] as const;

export const EXPERIMENTAL_SHOWCASE = Object.freeze([
  ...EXPERIMENTAL_ULTIMATES,
  ...VFX_LAB_II_WEAPONS,
]);

export type ExperimentalShowcaseId =
  | ExperimentalUltimateId
  | VfxLabWeaponId;

export type ExperimentalShowcaseDefinition =
  | ExperimentalUltimateDefinition
  | VfxLabWeaponDefinition;

export type ExperimentalShowcaseResolution =
  | ExperimentalResolutionResult
  | VfxLabResolutionResult;

export function isExperimentalShowcaseId(
  value: string,
): value is ExperimentalShowcaseId {
  return isExperimentalUltimateId(value) || isVfxLabWeaponId(value);
}

export function getExperimentalShowcase(
  id: ExperimentalShowcaseId,
): ExperimentalShowcaseDefinition {
  return isVfxLabWeaponId(id)
    ? getVfxLabWeapon(id)
    : getExperimentalUltimate(id);
}

export type ExperimentalShowcaseResolutionInput =
  | ExperimentalResolutionInput
  | VfxLabResolutionInput;

export function resolveExperimentalShowcase(
  input: ExperimentalShowcaseResolutionInput,
): ExperimentalShowcaseResolution {
  return "weaponId" in input
    ? resolveVfxLabWeapon(input)
    : resolveExperimentalUltimate(input);
}
