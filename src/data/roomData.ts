/**
 * Editorial copy for each chapter. Every figure here is taken from the Phase-1 data
 * (rooms.json areas are read live; dimensions below come from scene.json / validation_report.md).
 */
export interface RoomStory {
  room: string;           // rooms.json id
  title: string;          // display name (EN)
  line: string;           // one-sentence concept
  concept: string;        // short paragraph
  materials: string[];    // materials.json keys
  features: string[];
  furniture: string[];
  /** other rooms.json ids presented inside this chapter (for the index) */
  includes?: string[];
}

export const ROOM_STORIES: RoomStory[] = [
  {
    room: 'R01_ENTRY', title: 'Entry Foyer',
    line: 'Arrival, held in timber.',
    concept: 'A walnut double door on the west façade opens onto a foyer lined by a 1,600 mm shoe cabinet, with a walk-in coat closet and the storage room beside it.',
    materials: ['door_walnut', 'joinery_oak', 'floor_oak'],
    features: ['West-facing main entry', 'Walk-in coat closet', 'Storage room 3.28 m²'],
    furniture: ['Shoe cabinet 1600 × 350', 'Leather bench'],
    includes: ['R02_STORE'],
  },
  {
    room: 'R03_DINING', title: 'Dining',
    line: 'Gathered around oak and stone.',
    concept: 'A 1500 × 1000 oak table at 720 mm sits beside a 1540 × 1000 travertine island at 900 mm: the social core of the plan, open to the entry, living room and hallway.',
    materials: ['timber_oak_solid', 'stone_travertine', 'glass_lacquer'],
    features: ['Open plan to living & hall', 'Lacquered-glass wall 1791', 'Fridge & appliance wall'],
    furniture: ['Dining table 1500 × 1000', 'Island 1540 × 1000', 'Linear pendant 1200'],
  },
  {
    room: 'R04_KITCHEN', title: 'Kitchen',
    line: 'A galley behind glass.',
    concept: 'A 3,294 mm single-run kitchen with a quartzite benchtop, closed off from the dining room by glass sliding doors. Its north end opens to the service balcony.',
    materials: ['stone_quartzite', 'joinery_paint', 'metal_brushed'],
    features: ['Glass sliding doors', 'Service balcony access', 'North window'],
    furniture: ['Sink & hob run', 'Upper cabinets', 'Stone splashback'],
  },
  {
    room: 'R05_LIVING', title: 'Living Room',
    line: 'A long room, tuned to the light.',
    concept: '8.28 m of continuous joinery runs the west wall, centred on a walnut-framed TV unit. A 2.4 m bouclé sofa faces it, and full-height glazing opens south to the balcony.',
    materials: ['floor_oak', 'joinery_walnut', 'fabric_boucle', 'leather_tan'],
    features: ['8,279 mm west-wall joinery', 'South balcony glazing', 'Cat cabinet 850 × 1500'],
    furniture: ['Sofa 2414 × 700', 'Two leather lounge chairs', 'Nesting travertine tables'],
    includes: ['B03_BAL_SW'],
  },
  {
    room: 'R07_PLAY', title: 'Family Room',
    line: 'A flexible room for the family.',
    concept: 'Behind fluted-glass sliding doors on two sides, the family room holds the kids’ bookcase, an open shelf wall and a massage chair, with its own south balcony.',
    materials: ['joinery_oak', 'glass_fluted', 'leather_dark'],
    features: ['Sliding doors 1200 + 1200', 'Pocket door 1130', 'South balcony'],
    furniture: ['Kids bookcase 1312', 'Open bookcase 1103', 'Massage chair'],
    includes: ['B04_BAL_S'],
  },
  {
    room: 'R06_HALL', title: 'Hallway',
    line: 'The spine of the home.',
    concept: 'A 4.8 m east–west hallway links the public rooms to the private wing. The guest bath, the kids’ room and the study all open from it.',
    materials: ['floor_oak', 'wall_paint'],
    features: ['Guest bath off the hall', 'Kids’ room door', 'Opens to the study'],
    furniture: ['Recessed downlights'],
    includes: ['R09_BATH2'],
  },
  {
    room: 'R10_KIDS', title: 'Kids’ Room',
    line: 'Room to grow.',
    concept: 'A Queen bed, a desk at the east window, a 1,350 mm wardrobe and a 300 mm bookcase, with its own ensuite bath. An infant layout with two cots is also drawn.',
    materials: ['floor_oak', 'joinery_oak', 'fabric_boucle'],
    features: ['East window', 'Private ensuite', 'Infant cot layout drawn'],
    furniture: ['Queen bed 1820 × 1900', 'Desk at window', 'Wardrobe 1350'],
    includes: ['R08_BATH1'],
  },
  {
    room: 'R11_STUDY', title: 'Study',
    line: 'A library off the hallway.',
    concept: 'An open study framed by a 1,585 mm walnut book wall, with a reading nook and full-height glazing to the east balcony.',
    materials: ['joinery_walnut', 'timber_oak_solid', 'fabric_boucle'],
    features: ['Book wall 1585 × 395', 'Reading nook', 'East balcony'],
    furniture: ['Reading armchair', 'Writing desk (proposed)', 'Floor lamp'],
    includes: ['B06_BAL_E'],
  },
  {
    room: 'R14_MASTER', title: 'Master Bedroom',
    line: 'Quiet, and turned to the morning.',
    concept: 'A Queen bed rests against a 452 mm walnut bed-head wall on the east side. Full-height glazing opens south to the master balcony.',
    materials: ['joinery_walnut', 'fabric_white', 'stone_travertine'],
    features: ['Walnut bed-head wall', 'South balcony', 'Open link to the robe'],
    furniture: ['Queen bed 1820 × 1900', 'Travertine nightstands', 'Bed-end bench'],
    includes: ['B05_BAL_SE'],
  },
  {
    room: 'R12_CLOSET', title: 'Walk-in Robe',
    line: 'Between sleep and bath.',
    concept: 'A U-shaped robe with 1,650 mm and 1,900 mm runs and a dressing table, linking the bedroom to the ensuite.',
    materials: ['joinery_oak', 'stone_travertine', 'mirror'],
    features: ['U-shaped robe', 'Dressing table', 'Passage to ensuite'],
    furniture: ['Robe runs 1650 + 1900', 'Dressing table', 'Vanity stool'],
  },
  {
    room: 'R13_MBATH', title: 'Master Ensuite',
    line: 'Stone, water and microcement.',
    concept: 'A double vanity, a separate WC zone behind a privacy wall, and a bathtub set into its own alcove.',
    materials: ['microcement', 'stone_travertine', 'ceramic_white'],
    features: ['Double vanity', 'Separate WC zone', 'Bath alcove'],
    furniture: ['Bathtub', 'Backlit mirror', 'Wall-hung WC'],
  },
];

/** Material chapters: keys must exist in materials.json; `with` lists companion materials shown on the same stop. */
export interface MaterialStory { key: string; title: string; note: string; with?: string[] }

export const MATERIAL_STORIES: MaterialStory[] = [
  { key: 'microcement', title: 'Microcement', note: 'Seamless walls and floor across the three bathrooms: one continuous, warm grey surface without grout lines.', with: ['floor_microcement'] },
  { key: 'joinery_walnut', title: 'Smoked Walnut', note: 'The darker timber, kept for the places you touch or rest against: the TV wall, the bed-head and the study book wall.', with: ['door_walnut'] },
  { key: 'stone_travertine', title: 'Natural Stone', note: 'Filled, honed travertine on the island, vanities and nightstands, with white quartzite on the kitchen bench.', with: ['stone_quartzite', 'floor_stone'] },
  { key: 'floor_oak', title: 'Natural Oak', note: 'European oak in 190 mm planks with a natural oil finish, laid through every dry room and repeated in the joinery.', with: ['joinery_oak', 'timber_oak_solid'] },
  { key: 'fabric_boucle', title: 'Bouclé & Leather', note: 'Oat bouclé on the sofa and beds; tan vegetable-tanned leather on the lounge chairs, stools and bench.', with: ['leather_tan', 'fabric_linen'] },
  { key: 'glass_clear', title: 'Glass & Metal', note: 'Low-iron glass in slim black powder-coated frames, from the balcony sliders to the fluted family-room doors.', with: ['metal_black', 'glass_fluted'] },
];
