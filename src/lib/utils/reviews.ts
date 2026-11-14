/**
 * Below this many reviews we never show an average score anywhere (cards, PDP, spotlight,
 * reviews wall). "5.0 from 1 review" next to "be the first to review" reads as fake.
 */
export const MIN_REVIEWS_FOR_RATING = 5;

export const showRating = (count: number | undefined | null) => (count ?? 0) >= MIN_REVIEWS_FOR_RATING;
