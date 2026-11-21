export const ESCROW_MILESTONES = [
  {
    stageNumber: 1,
    title: 'Seed Lot / Organic Fiber Selection & Hand Spinning',
    percentage: 20.0,
    description: 'Certified indigenous raw fiber selection and spinning on traditional charkha.'
  },
  {
    stageNumber: 2,
    title: 'Natural Indigo & Herbal Vat Dyeing',
    percentage: 20.0,
    description: '100% natural herbal dyeing in traditional terracotta vats.'
  },
  {
    stageNumber: 3,
    title: 'Handloom Pit-Loom Weaving',
    percentage: 30.0,
    description: 'Handcrafted pit-loom or shuttle weaving with traditional motifs.'
  },
  {
    stageNumber: 4,
    title: 'Natural Sun Curing & Herbal Softening',
    percentage: 15.0,
    description: 'Courtyard sun curing and organic herbal finishing.'
  },
  {
    stageNumber: 5,
    title: 'GI Tag Inspection & Studio Packaging / Dispatch',
    percentage: 15.0,
    description: 'Authenticity verification seal and eco-friendly packaging.'
  }
];

export const OPTIMIZATION_WEIGHTS = {
  ALPHA: 0.35, // Quality Q(S) (sharpness, contrast, exposure)
  BETA: 0.25,  // Viewpoint Coverage C(S) (front, 45-deg, macro, maker mark)
  GAMMA: 0.25, // Visual Diversity D(S) (color/histogram diversity)
  DELTA: 0.15  // Redundancy Penalty R(S) (consecutive frame duplicates)
};

export const SUPPORTED_VIEWPOINTS = [
  'FRONT_HERO',
  'PERSPECTIVE_45',
  'MACRO_DETAIL',
  'MAKER_MARK',
  'REAR_OVERVIEW'
] as const;

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'Hindi (हिन्दी)' },
  { code: 'mr', name: 'Marathi (मराठी)' },
  { code: 'bn', name: 'Bengali (বাংলা)' },
  { code: 'gu', name: 'Gujarati (ગુજરાતી)' },
  { code: 'ta', name: 'Tamil (தமிழ்)' },
  { code: 'te', name: 'Telugu (తెలుగు)' },
  { code: 'bho', name: 'Bhojpuri (भोजपुरी)' },
  { code: 'kut', name: 'Kutchhi (કચ્છી)' }
];
