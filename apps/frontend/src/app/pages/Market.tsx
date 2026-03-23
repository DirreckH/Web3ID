import { AnimatePresence, motion } from "motion/react";
import { Plus, Search, TrendingUp } from "lucide-react";
import { useState } from "react";
import { AssetDetailModal } from "../components/AssetDetailModal";
import { LiquidGlassButton } from "../components/LiquidGlassButton";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";

interface RWAAsset {
  id: string;
  name: string;
  type:
    | "real-estate"
    | "art"
    | "bonds"
    | "commodities"
    | "equity"
    | "ip-royalties"
    | "carbon-credits"
    | "luxury-goods"
    | "restricted";
  image: string;
  price: number;
  apy: number;
  totalValue: number;
  available: number;
  location?: string;
  status: "active" | "sold-out" | "coming-soon";
  description?: string;
}

interface Transaction {
  id: string;
  assetName: string;
  quantity: number;
  total: number;
  date: string;
}

const ASSET_TYPES = [
  { id: "all", label: "全部", icon: "🌐" },
  { id: "real-estate", label: "房地产", icon: "🏢" },
  { id: "art", label: "艺术品", icon: "🎨" },
  { id: "bonds", label: "债券", icon: "📈" },
  { id: "commodities", label: "大宗商品", icon: "⚡" },
  { id: "equity", label: "股权", icon: "💼" },
  { id: "ip-royalties", label: "IP版权", icon: "🎵" },
  { id: "carbon-credits", label: "碳信用", icon: "🌱" },
  { id: "luxury-goods", label: "奢侈品", icon: "💎" },
  { id: "restricted", label: "合规受限", icon: "🔒" },
] as const;

const MOCK_ASSETS: RWAAsset[] = [
  {
    id: "1",
    name: "纽约曼哈顿公寓",
    type: "real-estate",
    image: "real estate manhattan apartment",
    price: 250000,
    apy: 8.5,
    totalValue: 5000000,
    available: 15,
    location: "纽约, 美国",
    status: "active",
    description: "曼哈顿核心地段高端公寓，租金收益稳定",
  },
  {
    id: "2",
    name: "伦敦商业地产",
    type: "real-estate",
    image: "london office building",
    price: 350000,
    apy: 7.8,
    totalValue: 8000000,
    available: 8,
    location: "伦敦, 英国",
    status: "active",
    description: "金融城核心区办公楼，长期租赁合同",
  },
  {
    id: "3",
    name: "迪拜豪华别墅",
    type: "real-estate",
    image: "dubai luxury villa",
    price: 800000,
    apy: 9.2,
    totalValue: 12000000,
    available: 5,
    location: "迪拜, 阿联酋",
    status: "coming-soon",
    description: "棕榈岛独栋别墅，私人海滩",
  },
  {
    id: "4",
    name: "东京涩谷商铺",
    type: "real-estate",
    image: "tokyo shibuya retail",
    price: 450000,
    apy: 7.2,
    totalValue: 6500000,
    available: 12,
    location: "东京, 日本",
    status: "active",
    description: "涩谷十字路口旺铺，客流量大",
  },
  {
    id: "5",
    name: "毕加索原作《和平鸽》",
    type: "art",
    image: "picasso painting art gallery",
    price: 500000,
    apy: 12.3,
    totalValue: 2000000,
    available: 3,
    location: "苏富比",
    status: "active",
    description: "1949年经典作品，完整溯源记录",
  },
  {
    id: "6",
    name: "班克斯街头艺术",
    type: "art",
    image: "banksy street art graffiti",
    price: 180000,
    apy: 15.8,
    totalValue: 1500000,
    available: 6,
    location: "佳士得",
    status: "active",
    description: "稀有墙体原作，市场热度高",
  },
  {
    id: "7",
    name: "安迪·沃霍尔作品集",
    type: "art",
    image: "andy warhol pop art",
    price: 320000,
    apy: 11.5,
    totalValue: 2800000,
    available: 7,
    location: "MOMA",
    status: "active",
    description: "波普艺术巨匠代表作，收藏级",
  },
  {
    id: "8",
    name: "美国国债ETF",
    type: "bonds",
    image: "financial bonds stock market",
    price: 10000,
    apy: 5.2,
    totalValue: 10000000,
    available: 850,
    status: "active",
    description: "AAA级主权债券，安全稳健",
  },
  {
    id: "9",
    name: "欧洲绿色债券",
    type: "bonds",
    image: "green bonds sustainable finance",
    price: 25000,
    apy: 6.5,
    totalValue: 8000000,
    available: 280,
    location: "欧盟",
    status: "active",
    description: "ESG认证，支持可再生能源项目",
  },
  {
    id: "10",
    name: "新兴市场高收益债",
    type: "bonds",
    image: "emerging market bonds",
    price: 15000,
    apy: 9.8,
    totalValue: 5000000,
    available: 320,
    status: "active",
    description: "精选新兴市场，收益率高",
  },
  {
    id: "11",
    name: "黄金储备份额",
    type: "commodities",
    image: "gold bars vault",
    price: 50000,
    apy: 4.5,
    totalValue: 15000000,
    available: 200,
    location: "瑞士金库",
    status: "active",
    description: "实物黄金托管，抗通胀资产",
  },
  {
    id: "12",
    name: "原油期货份额",
    type: "commodities",
    image: "crude oil barrels",
    price: 30000,
    apy: 8.2,
    totalValue: 12000000,
    available: 350,
    location: "WTI",
    status: "active",
    description: "布伦特原油期货，对冲能源风险",
  },
  {
    id: "13",
    name: "白银储备",
    type: "commodities",
    image: "silver bullion bars",
    price: 20000,
    apy: 5.8,
    totalValue: 6000000,
    available: 280,
    location: "伦敦金属交易所",
    status: "active",
    description: "工业金属 + 贵金属双重属性",
  },
  {
    id: "14",
    name: "硅谷科技初创股权",
    type: "equity",
    image: "silicon valley startup office",
    price: 100000,
    apy: 25.0,
    totalValue: 5000000,
    available: 40,
    location: "加州, 美国",
    status: "active",
    description: "AI赛道明星公司，A轮估值3亿美元",
  },
  {
    id: "15",
    name: "欧洲生物科技股权",
    type: "equity",
    image: "biotech laboratory research",
    price: 150000,
    apy: 18.5,
    totalValue: 8000000,
    available: 45,
    location: "苏黎世, 瑞士",
    status: "active",
    description: "癌症疗法研发，已进入临床三期",
  },
  {
    id: "16",
    name: "东南亚电商平台股权",
    type: "equity",
    image: "ecommerce warehouse logistics",
    price: 80000,
    apy: 22.0,
    totalValue: 4000000,
    available: 35,
    location: "新加坡",
    status: "coming-soon",
    description: "覆盖6国市场，GMV高速增长",
  },
  {
    id: "17",
    name: "好莱坞电影版权",
    type: "ip-royalties",
    image: "hollywood movie production",
    price: 200000,
    apy: 14.2,
    totalValue: 10000000,
    available: 40,
    location: "洛杉矶, 美国",
    status: "active",
    description: "票房破10亿美元系列电影版权收益",
  },
  {
    id: "18",
    name: "流行音乐版税",
    type: "ip-royalties",
    image: "music studio recording",
    price: 75000,
    apy: 16.5,
    totalValue: 3000000,
    available: 30,
    location: "Spotify/Apple Music",
    status: "active",
    description: "格莱美获奖专辑，流媒体收益稳定",
  },
  {
    id: "19",
    name: "游戏IP授权",
    type: "ip-royalties",
    image: "video game concept art",
    price: 120000,
    apy: 19.8,
    totalValue: 6000000,
    available: 42,
    location: "全球",
    status: "active",
    description: "3A大作IP，周边授权收入丰厚",
  },
  {
    id: "20",
    name: "亚马逊雨林碳汇",
    type: "carbon-credits",
    image: "amazon rainforest carbon",
    price: 15000,
    apy: 10.5,
    totalValue: 4000000,
    available: 250,
    location: "巴西",
    status: "active",
    description: "VCS认证碳信用额度，永久林权",
  },
  {
    id: "21",
    name: "风电场碳积分",
    type: "carbon-credits",
    image: "wind farm renewable energy",
    price: 12000,
    apy: 8.9,
    totalValue: 3500000,
    available: 280,
    location: "北欧",
    status: "active",
    description: "Gold Standard认证，清洁能源项目",
  },
  {
    id: "22",
    name: "海洋碳捕获项目",
    type: "carbon-credits",
    image: "ocean carbon capture",
    price: 18000,
    apy: 11.2,
    totalValue: 5000000,
    available: 220,
    location: "澳大利亚",
    status: "coming-soon",
    description: "创新蓝碳技术，未来市场潜力大",
  },
  {
    id: "23",
    name: "爱马仕限量包",
    type: "luxury-goods",
    image: "hermes birkin bag luxury",
    price: 90000,
    apy: 13.5,
    totalValue: 2000000,
    available: 18,
    location: "巴黎",
    status: "active",
    description: "Birkin鳄鱼皮限量款，保值增值佳品",
  },
  {
    id: "24",
    name: "百达翡丽腕表",
    type: "luxury-goods",
    image: "patek philippe watch luxury",
    price: 250000,
    apy: 17.2,
    totalValue: 5000000,
    available: 16,
    location: "日内瓦",
    status: "active",
    description: "鹦鹉螺系列，拍卖记录屡创新高",
  },
  {
    id: "25",
    name: "稀有葡萄酒窖藏",
    type: "luxury-goods",
    image: "rare wine collection cellar",
    price: 60000,
    apy: 12.0,
    totalValue: 3000000,
    available: 42,
    location: "波尔多, 法国",
    status: "active",
    description: "拉菲82年等顶级酒款，专业恒温储藏",
  },
  {
    id: "26",
    name: "北美防务科技股权",
    type: "restricted",
    image: "military defense technology security",
    price: 5000000,
    apy: 15.0,
    totalValue: 100000000,
    available: 5,
    location: "华盛顿, 美国",
    status: "active",
    description: "受严格监管的防务公司股权，基于 Web3ID 及跨国 KYC/AML 联邦认证，仅限特定白名单用户认购。",
  },
  {
    id: "27",
    name: "瑞士战略核设施",
    type: "restricted",
    image: "nuclear power plant facility switzerland",
    price: 2000000,
    apy: 8.5,
    totalValue: 50000000,
    available: 10,
    location: "伯尔尼, 瑞士",
    status: "active",
    description: "涉及国家安全的战略能源基建项目，申购必须满足最高等级的 Web3ID 合规审计要求。",
  },
];

export function Market() {
  const [selectedType, setSelectedType] = useState<string>("all");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<RWAAsset | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredAssets = selectedType === "all" ? MOCK_ASSETS : MOCK_ASSETS.filter((asset) => asset.type === selectedType);

  const handlePurchaseComplete = (assetId: string, quantity: number, total: number) => {
    const asset = MOCK_ASSETS.find((item) => item.id === assetId);
    if (!asset) {
      return;
    }

    const transaction: Transaction = {
      id: Date.now().toString(),
      assetName: asset.name,
      quantity,
      total,
      date: new Date().toLocaleDateString("zh-CN"),
    };

    setTransactions([transaction, ...transactions]);
  };

  const totalMarketCap = MOCK_ASSETS.reduce((sum, asset) => sum + asset.totalValue, 0);
  const avgAPY = MOCK_ASSETS.reduce((sum, asset) => sum + asset.apy, 0) / MOCK_ASSETS.length;
  const totalAssets = MOCK_ASSETS.length;

  const displayAssets = filteredAssets.filter((asset) => {
    if (searchQuery === "") {
      return true;
    }

    return (
      asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <div className="min-h-full bg-gradient-to-b from-gray-50 to-white pb-24" data-testid="market-page">
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="border-b border-gray-100/50 bg-white/80 px-6 pb-6 pt-12 backdrop-blur-xl"
        initial={{ opacity: 0, y: -20 }}
      >
        <div className="relative mb-6 flex items-center justify-between">
          <AnimatePresence mode="wait">
            {!isSearchOpen ? (
              <motion.div
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                initial={{ opacity: 0, x: -20 }}
                key="title"
                transition={{ duration: 0.3 }}
              >
                <h1 className="text-3xl font-bold tracking-tight text-gray-900">RWA 商城</h1>
                <p className="mt-1 text-sm text-gray-500">探索全球优质实物资产</p>
              </motion.div>
            ) : (
              <motion.div
                animate={{ opacity: 1, scale: 1 }}
                className="mr-4 flex-1"
                exit={{ opacity: 0, scale: 0.95 }}
                initial={{ opacity: 0, scale: 0.95 }}
                key="search"
                transition={{ duration: 0.3 }}
              >
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <input
                    autoFocus
                    className="w-full rounded-2xl bg-gray-100 py-3 pl-12 pr-4 text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                    data-testid="market-search"
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="搜索资产名称、地点或描述..."
                    type="text"
                    value={searchQuery}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <LiquidGlassButton onClick={() => setIsSearchOpen(!isSearchOpen)} size="md" variant="dark">
            <motion.div animate={{ rotate: isSearchOpen ? 90 : 0 }} transition={{ duration: 0.3 }}>
              {isSearchOpen ? <Plus className="h-5 w-5 rotate-45 text-white" strokeWidth={2} /> : <Search className="h-5 w-5 text-white" strokeWidth={2} />}
            </motion.div>
          </LiquidGlassButton>
        </div>

        <motion.div animate={{ opacity: 1, y: 0 }} className="mt-6 grid grid-cols-3 gap-3" initial={{ opacity: 0, y: 10 }} transition={{ delay: 0.2 }}>
          <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 p-4 shadow-lg shadow-blue-500/20">
            <div className="mb-1 text-xs font-medium text-white/80">总市值</div>
            <div className="text-lg font-bold text-white">${(totalMarketCap / 1000000).toFixed(1)}M</div>
          </div>
          <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-4 shadow-lg shadow-emerald-500/20">
            <div className="mb-1 text-xs font-medium text-white/80">平均APY</div>
            <div className="flex items-center gap-1 text-lg font-bold text-white">
              {avgAPY.toFixed(1)}%
              <TrendingUp className="h-4 w-4" strokeWidth={2.5} />
            </div>
          </div>
          <div className="rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 p-4 shadow-lg shadow-purple-500/20">
            <div className="mb-1 text-xs font-medium text-white/80">资产数量</div>
            <div className="text-lg font-bold text-white">{totalAssets}</div>
          </div>
        </motion.div>
      </motion.div>

      <div className="scrollbar-hide overflow-x-auto px-6 py-5">
        <motion.div animate={{ opacity: 1 }} className="flex gap-2.5" initial={{ opacity: 0 }} transition={{ delay: 0.3 }}>
          {ASSET_TYPES.map((type, index) => (
            <motion.button
              key={type.id}
              animate={{ opacity: 1, y: 0 }}
              className={`flex items-center gap-2 whitespace-nowrap rounded-2xl px-4 py-2.5 font-medium shadow-sm transition-all ${
                selectedType === type.id
                  ? "bg-gradient-to-r from-gray-900 to-gray-800 text-white shadow-md"
                  : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              }`}
              data-testid={`market-filter-${type.id}`}
              initial={{ opacity: 0, y: 10 }}
              onClick={() => {
                setSelectedType(type.id);
                setSearchQuery("");
              }}
              transition={{ delay: 0.3 + index * 0.05 }}
              type="button"
              whileTap={{ scale: 0.95 }}
            >
              <span className="text-base">{type.icon}</span>
              <span className="text-sm">{type.label}</span>
            </motion.button>
          ))}
        </motion.div>
      </div>

      <div className="space-y-4 px-6">
        <AnimatePresence mode="wait">
          {displayAssets.length === 0 ? (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="py-20 text-center"
              exit={{ opacity: 0, y: -20 }}
              initial={{ opacity: 0, y: 20 }}
              key="empty"
            >
              <div className="mb-4 text-6xl">🔍</div>
              <h3 className="mb-2 text-xl font-bold text-gray-900">未找到匹配资产</h3>
              <p className="text-gray-500">试试其他搜索关键词或切换分类</p>
            </motion.div>
          ) : (
            <motion.div animate={{ opacity: 1 }} className="space-y-4" exit={{ opacity: 0 }} initial={{ opacity: 0 }} key={`assets-${selectedType}`} transition={{ duration: 0.2 }}>
              {displayAssets.map((asset, index) => (
                <motion.button
                  key={asset.id}
                  animate={{ opacity: 1, y: 0 }}
                  className="cursor-pointer overflow-hidden rounded-3xl border border-gray-100/50 bg-white text-left shadow-sm transition-all hover:shadow-xl"
                  data-testid={`market-card-${asset.id}`}
                  initial={{ opacity: 0, y: 20 }}
                  onClick={() => setSelectedAsset(asset)}
                  transition={{ delay: index * 0.05, duration: 0.3 }}
                  type="button"
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="relative h-48 overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200">
                    <ImageWithFallback
                      alt={asset.name}
                      className="h-full w-full object-cover"
                      src={`https://source.unsplash.com/800x600/?${asset.image}`}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

                    <div className="absolute right-3 top-3">
                      {asset.status === "coming-soon" ? (
                        <div className="rounded-full bg-gradient-to-r from-yellow-500 to-orange-500 px-3 py-1.5 text-xs font-bold text-white shadow-lg backdrop-blur-sm">即将推出</div>
                      ) : null}
                      {asset.status === "sold-out" ? (
                        <div className="rounded-full bg-gray-900/90 px-3 py-1.5 text-xs font-bold text-white shadow-lg backdrop-blur-sm">已售罄</div>
                      ) : null}
                      {asset.status === "active" && asset.type !== "restricted" ? (
                        <div className="rounded-full bg-gradient-to-r from-emerald-500 to-green-500 px-3 py-1.5 text-xs font-bold text-white shadow-lg backdrop-blur-sm">可购买</div>
                      ) : null}
                      {asset.type === "restricted" ? (
                        <div className="flex items-center gap-1 rounded-full bg-gradient-to-r from-red-500 to-rose-600 px-3 py-1.5 text-xs font-bold text-white shadow-lg backdrop-blur-sm">
                          <span className="text-[10px]">🔒</span> 合规受限
                        </div>
                      ) : null}
                    </div>

                    <div className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1.5 text-sm font-bold text-gray-900 shadow-lg backdrop-blur-md">
                      <span className="text-emerald-600">APY</span> {asset.apy}%
                    </div>
                  </div>

                  <div className="p-5">
                    <div className="mb-3 flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="mb-1 text-lg font-bold text-gray-900">{asset.name}</h3>
                        {asset.location ? <p className="flex items-center gap-1 text-sm text-gray-500">📍{asset.location}</p> : null}
                      </div>
                    </div>

                    {asset.description ? <p className="mb-4 line-clamp-2 text-sm text-gray-600">{asset.description}</p> : null}

                    <div className="grid grid-cols-3 gap-4 border-t border-gray-100 pt-4">
                      <div>
                        <div className="mb-1 text-xs font-medium text-gray-500">单价</div>
                        <div className="text-sm font-bold text-gray-900">${(asset.price / 1000).toFixed(0)}K</div>
                      </div>
                      <div>
                        <div className="mb-1 text-xs font-medium text-gray-500">总价值</div>
                        <div className="text-sm font-bold text-gray-900">${(asset.totalValue / 1000000).toFixed(1)}M</div>
                      </div>
                      <div>
                        <div className="mb-1 text-xs font-medium text-gray-500">可购买</div>
                        <div className="text-sm font-bold text-emerald-600">{asset.available} 份</div>
                      </div>
                    </div>
                  </div>
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AssetDetailModal
        asset={selectedAsset}
        isOpen={selectedAsset !== null}
        onClose={() => setSelectedAsset(null)}
        onPurchaseComplete={handlePurchaseComplete}
      />
    </div>
  );
}
