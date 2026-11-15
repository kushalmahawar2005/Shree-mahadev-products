/**
 * "Why Mahadev <oil>?" checklist under the PDP title (oils only).
 * The client's six points; the aroma line is per oil, everything else is true for every oil we sell.
 */
const AROMA: Record<string, string> = {
  "groundnut-oil": "Nutty aroma",
  "yellow-mustard-oil": "Sharp mustard aroma",
  "black-mustard-oil": "Strong, pungent aroma",
  "white-sesame-oil": "Mild til aroma",
  "brown-sesame-oil": "Toasty til aroma",
  "black-sesame-oil": "Rich til aroma",
  "coconut-oil": "Fresh coconut aroma",
  "almond-oil": "Light almond aroma",
  "walnut-oil": "Soft walnut aroma",
  "sunflower-oil": "Light, clean aroma",
  "flaxseed-oil": "Earthy, nutty aroma",
};

export function oilWhyPoints(handle: string): string[] {
  return [
    "Only traditional kachi ghani extraction",
    AROMA[handle] ?? "Natural aroma of the seed",
    "No filter press, gravity sedimentation",
    "100% natural",
    "No chemicals",
    "No preservatives",
  ];
}
