/** 中文版章節文案。數字與 roomData.ts（英文）一致，皆取自 Phase 1 資料。 */
export interface StoryZh { title: string; line: string; concept: string; features: string[]; furniture: string[] }

export const ROOM_STORIES_ZH: Record<string, StoryZh> = {
  R01_ENTRY: {
    title: '玄關',
    line: '以木質迎接每一次回家。',
    concept: '西側立面的胡桃木雙開大門，進門即是 1,600 mm 鞋櫃界定的玄關，旁邊是步入式衣帽間與儲藏室。',
    features: ['西向主入口', '步入式衣帽間', '儲藏室 3.28 m²'],
    furniture: ['鞋櫃 1600 × 350', '皮革穿鞋椅'],
  },
  R03_DINING: {
    title: '餐廳',
    line: '圍繞橡木與石材相聚。',
    concept: '1500 × 1000、高 720 mm 的橡木餐桌，旁邊是 1540 × 1000、高 900 mm 的洞石中島，是整個平面的社交核心，向玄關、客廳與走道開放。',
    features: ['與客廳、走道開放相連', '烤漆玻璃牆 1791', '冰箱與電器牆'],
    furniture: ['餐桌 1500 × 1000', '中島 1540 × 1000', '線型吊燈 1200'],
  },
  R04_KITCHEN: {
    title: '廚房',
    line: '玻璃門後的一字型廚房。',
    concept: '3,294 mm 一字型廚具配石英岩檯面，以玻璃橫拉門與餐廳區隔，北端通往工作陽台。',
    features: ['玻璃橫拉門', '通往工作陽台', '北向窗'],
    furniture: ['水槽與爐台', '吊櫃', '石材背牆'],
  },
  R05_LIVING: {
    title: '客廳',
    line: '一個隨光線調和的長型空間。',
    concept: '西牆 8.28 m 連續櫃體，中央是胡桃木框電視櫃。對面是 2.4 m 圈圈紗沙發，南側落地玻璃通往陽台。',
    features: ['西牆櫃體 8,279 mm', '南向陽台落地窗', '貓櫃 850 × 1500'],
    furniture: ['沙發 2414 × 700', '兩張皮革單椅', '洞石子母茶几'],
  },
  R07_PLAY: {
    title: '家庭室',
    line: '一間屬於全家的彈性空間。',
    concept: '兩側為長虹玻璃橫拉門，室內有兒童書櫃、開放層架牆與按摩椅，並有專屬南向陽台。',
    features: ['橫拉門 1200 + 1200', '隱藏拉門 1130', '南向陽台'],
    furniture: ['兒童書櫃 1312', '開放書櫃 1103', '按摩椅'],
  },
  R06_HALL: {
    title: '走道',
    line: '串起整個家的主軸。',
    concept: '4.8 m 東西向走道連接公共空間與私密區，客浴、小孩房與書房都由此進出。',
    features: ['客浴位於走道旁', '小孩房房門', '通往書房'],
    furniture: ['嵌燈'],
  },
  R10_KIDS: {
    title: '小孩房',
    line: '陪著孩子一起長大。',
    concept: 'Queen 床、東窗前的書桌、1,350 mm 衣櫃與 300 mm 書櫃，並附專屬衛浴。圖面另繪有兩張嬰兒床的配置。',
    features: ['東向窗', '專屬衛浴', '圖面另有嬰兒床配置'],
    furniture: ['Queen 床 1820 × 1900', '窗前書桌', '衣櫃 1350'],
  },
  R11_STUDY: {
    title: '書房',
    line: '走道旁的一座小圖書館。',
    concept: '開放式書房以 1,585 mm 胡桃木書牆界定，設有閱讀角，落地玻璃通往東側陽台。',
    features: ['書牆 1585 × 395', '閱讀角', '東側陽台'],
    furniture: ['閱讀單椅', '書桌（提案）', '立燈'],
  },
  R14_MASTER: {
    title: '主臥',
    line: '安靜，迎向晨光。',
    concept: 'Queen 床靠著東側 452 mm 胡桃木床頭牆，南側落地玻璃通往主臥陽台。',
    features: ['胡桃木床頭牆', '南向陽台', '與更衣室開放相連'],
    furniture: ['Queen 床 1820 × 1900', '洞石床頭櫃', '床尾椅'],
  },
  R12_CLOSET: {
    title: '更衣室',
    line: '介於睡眠與沐浴之間。',
    concept: 'U 型更衣室，櫃體長 1,650 mm 與 1,900 mm，附化妝台，連接主臥與主浴。',
    features: ['U 型衣櫃', '化妝台', '通往主浴'],
    furniture: ['衣櫃 1650 + 1900', '化妝台', '化妝椅'],
  },
  R13_MBATH: {
    title: '主浴',
    line: '石材、水與微水泥。',
    concept: '雙槽浴櫃、以隱私牆隔開的獨立馬桶區，以及獨立凹室內的浴缸。',
    features: ['雙槽浴櫃', '獨立馬桶區', '浴缸凹室'],
    furniture: ['浴缸', '背光鏡', '壁掛馬桶'],
  },
};

export const MATERIAL_STORIES_ZH: Record<string, { title: string; note: string }> = {
  microcement: { title: '微水泥', note: '三間浴室的牆面與地坪一體成形：一片連續、溫潤的灰色表面，沒有磁磚縫。' },
  joinery_walnut: { title: '煙燻胡桃木', note: '較深的木色，留給手會碰觸、身體會倚靠的地方：電視牆、床頭與書房書牆。' },
  stone_travertine: { title: '天然石材', note: '中島、浴櫃與床頭櫃使用填孔霧面洞石，廚房檯面則是白色石英岩。' },
  floor_oak: { title: '天然橡木', note: '190 mm 歐洲橡木地板、自然油處理，鋪滿所有乾區，並延伸到櫃體。' },
  fabric_boucle: { title: '圈圈紗與皮革', note: '沙發與床組使用燕麥色圈圈紗；單椅、高腳椅與長凳使用駝色植鞣皮。' },
  glass_clear: { title: '玻璃與金屬', note: '超白玻璃搭配細黑框，從陽台拉門到家庭室的長虹玻璃門。' },
};
