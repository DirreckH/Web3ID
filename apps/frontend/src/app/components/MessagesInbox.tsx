import { AnimatePresence, motion } from "motion/react";
import { Archive, ArrowLeft, Circle, Search, Trash2 } from "lucide-react";
import { useState } from "react";

interface Message {
  id: string;
  from: string;
  fromAddress: string;
  subject: string;
  preview: string;
  timestamp: string;
  type: "transfer" | "contract" | "notification" | "security";
  network: string;
  read: boolean;
  starred: boolean;
}

interface MessagesInboxProps {
  onClose: () => void;
}

const MOCK_MESSAGES: Message[] = [
  {
    id: "1",
    from: "Ethereum Network",
    fromAddress: "0x742d...3a9c",
    subject: "\u6536\u5230\u8f6c\u8d26\u901a\u77e5",
    preview: "\u60a8\u7684\u5730\u5740 0x1234...5678 \u6536\u5230\u4e86 2.5 ETH",
    timestamp: "5\u5206\u949f\u524d",
    type: "transfer",
    network: "Ethereum",
    read: false,
    starred: false,
  },
  {
    id: "2",
    from: "Uniswap V3",
    fromAddress: "0x1f98...6045",
    subject: "\u6d41\u52a8\u6027\u6c60\u6536\u76ca\u901a\u77e5",
    preview: "\u60a8\u5728 ETH-USDC \u6c60\u4e2d\u83b7\u5f97\u4e86 45.2 USDC \u7684\u624b\u7eed\u8d39\u6536\u76ca",
    timestamp: "2\u5c0f\u65f6\u524d",
    type: "notification",
    network: "Ethereum",
    read: false,
    starred: true,
  },
  {
    id: "3",
    from: "Security Alert",
    fromAddress: "System",
    subject: "\u65b0\u8bbe\u5907\u767b\u5f55\u63d0\u9192",
    preview: "\u68c0\u6d4b\u5230\u6765\u81ea\u65b0\u8bbe\u5907\u7684\u767b\u5f55\u8bf7\u6c42\uff0cIP: 192.168.1.100",
    timestamp: "\u6628\u5929",
    type: "security",
    network: "System",
    read: true,
    starred: false,
  },
  {
    id: "4",
    from: "Solana Network",
    fromAddress: "7xKX...9Qm2",
    subject: "NFT\u94f8\u9020\u6210\u529f",
    preview: "\u60a8\u7684 NFT \u5df2\u6210\u529f\u94f8\u9020\u5230\u5730\u5740 7xKX...9Qm2",
    timestamp: "\u6628\u5929",
    type: "contract",
    network: "Solana",
    read: true,
    starred: false,
  },
  {
    id: "5",
    from: "Arbitrum Bridge",
    fromAddress: "0x8315...4f67",
    subject: "\u8de8\u94fe\u8f6c\u8d26\u786e\u8ba4",
    preview: "\u60a8\u7684 1000 USDC \u5df2\u4ece Ethereum \u6210\u529f\u6865\u63a5\u5230 Arbitrum",
    timestamp: "2\u5929\u524d",
    type: "transfer",
    network: "Arbitrum",
    read: true,
    starred: false,
  },
  {
    id: "6",
    from: "Aave Protocol",
    fromAddress: "0x7d2f...8b3a",
    subject: "\u62b5\u62bc\u7269\u9884\u8b66",
    preview: "\u60a8\u7684\u62b5\u62bc\u7387\u5df2\u964d\u81f3 150%\uff0c\u5efa\u8bae\u589e\u52a0\u62b5\u62bc\u7269",
    timestamp: "3\u5929\u524d",
    type: "notification",
    network: "Ethereum",
    read: true,
    starred: true,
  },
];

const MESSAGE_TYPE_COLORS: Record<Message["type"], { bg: string; text: string; label: string }> = {
  transfer: { bg: "bg-blue-50", text: "text-blue-600", label: "\u8f6c\u8d26" },
  contract: { bg: "bg-purple-50", text: "text-purple-600", label: "\u5408\u7ea6" },
  notification: { bg: "bg-green-50", text: "text-green-600", label: "\u901a\u77e5" },
  security: { bg: "bg-red-50", text: "text-red-600", label: "\u5b89\u5168" },
};

export function MessagesInbox({ onClose }: MessagesInboxProps) {
  const [messages, setMessages] = useState(MOCK_MESSAGES);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const handleMarkAsRead = (messageId: string) => {
    setMessages(messages.map((message) => (message.id === messageId ? { ...message, read: true } : message)));
  };

  const handleDelete = (messageId: string) => {
    setMessages(messages.filter((message) => message.id !== messageId));
    if (selectedMessage?.id === messageId) {
      setSelectedMessage(null);
    }
  };

  const handleStarToggle = (messageId: string) => {
    setMessages(messages.map((message) => (message.id === messageId ? { ...message, starred: !message.starred } : message)));
  };

  const unreadCount = messages.filter((message) => !message.read).length;

  return (
    <motion.div
      animate={{ x: 0 }}
      className="fixed inset-0 z-40 bg-gray-50"
      data-testid="messages-inbox"
      exit={{ x: "100%" }}
      initial={{ x: "100%" }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <div className="border-b border-gray-200 bg-white px-6 pb-4 pt-12">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.button className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 transition-colors hover:bg-gray-200" onClick={onClose} type="button" whileTap={{ scale: 0.9 }}>
              <ArrowLeft className="h-5 w-5" />
            </motion.button>

            <AnimatePresence mode="wait">
              {!isSearchOpen ? (
                <motion.div animate={{ opacity: 1 }} exit={{ opacity: 0 }} initial={{ opacity: 0 }}>
                  <h1 className="text-2xl font-semibold">{"\u6536\u4ef6\u7bb1"}</h1>
                  {unreadCount > 0 ? <div className="text-sm text-gray-500">{unreadCount} {"\u6761\u672a\u8bfb"}</div> : null}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          <AnimatePresence>
            {isSearchOpen ? (
              <motion.div
                animate={{ opacity: 1, width: "60%" }}
                className="absolute left-24 right-20 overflow-hidden"
                exit={{ opacity: 0, width: 0 }}
                initial={{ opacity: 0, width: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              >
                <input autoFocus className="w-full rounded-full bg-gray-100 pl-4 pr-4 py-2 outline-none transition-colors focus:bg-gray-200" placeholder={"\u641c\u7d22\u6d88\u606f..."} type="text" />
              </motion.div>
            ) : null}
          </AnimatePresence>

          <motion.button className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-900 transition-colors hover:bg-gray-800" onClick={() => setIsSearchOpen(!isSearchOpen)} type="button" whileTap={{ scale: 0.9 }}>
            <Search className="h-5 w-5 text-white" strokeWidth={2} />
          </motion.button>
        </div>
      </div>

      <div className="overflow-y-auto pb-24" style={{ height: "calc(100vh - 140px)" }}>
        {!selectedMessage ? (
          <div className="divide-y divide-gray-200">
            {messages.map((message) => {
              const typeInfo = MESSAGE_TYPE_COLORS[message.type];

              return (
                <motion.div
                  key={message.id}
                  animate={{ opacity: 1, y: 0 }}
                  className={`cursor-pointer bg-white px-6 py-4 transition-colors hover:bg-gray-50 ${!message.read ? "border-l-4 border-blue-500" : ""}`}
                  initial={{ opacity: 0, y: 20 }}
                  onClick={() => {
                    setSelectedMessage(message);
                    handleMarkAsRead(message.id);
                  }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex items-start gap-3">
                    <div className="pt-1">
                      {message.read ? <Circle className="h-3 w-3 text-gray-300" /> : <Circle className="h-3 w-3 fill-blue-500 text-blue-500" />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`text-gray-900 ${!message.read ? "font-bold" : "font-semibold"}`}>{message.from}</span>
                          <span className={`rounded-full px-2 py-0.5 text-xs ${typeInfo.bg} ${typeInfo.text}`}>{typeInfo.label}</span>
                        </div>
                        <span className="text-xs text-gray-500">{message.timestamp}</span>
                      </div>
                      <div className={`mb-1 text-sm text-gray-900 ${!message.read ? "font-semibold" : ""}`}>{message.subject}</div>
                      <div className="truncate text-sm text-gray-600">{message.preview}</div>
                      <div className="mt-2 flex items-center gap-3">
                        <span className="font-mono text-xs text-gray-500">{message.fromAddress}</span>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs text-gray-500">{message.network}</span>
                      </div>
                    </div>

                    <button
                      className="pt-1"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleStarToggle(message.id);
                      }}
                      type="button"
                    >
                      {message.starred ? (
                        <svg className="h-5 w-5 fill-yellow-500 text-yellow-500" viewBox="0 0 24 24">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5 text-gray-300 hover:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <motion.div animate={{ opacity: 1, x: 0 }} className="min-h-full bg-white" initial={{ opacity: 0, x: 20 }}>
            <div className="flex items-center gap-2 border-b border-gray-200 px-6 py-4">
              <motion.button className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 transition-colors hover:bg-gray-200" onClick={() => setSelectedMessage(null)} type="button" whileTap={{ scale: 0.9 }}>
                <ArrowLeft className="h-5 w-5" />
              </motion.button>
              <div className="flex-1" />
              <motion.button className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 transition-colors hover:bg-gray-200" type="button" whileTap={{ scale: 0.9 }}>
                <Archive className="h-5 w-5 text-gray-700" />
              </motion.button>
              <motion.button className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 transition-colors hover:bg-red-50" onClick={() => handleDelete(selectedMessage.id)} type="button" whileTap={{ scale: 0.9 }}>
                <Trash2 className="h-5 w-5 text-red-500" />
              </motion.button>
            </div>

            <div className="p-6">
              <div className="mb-6">
                {(() => {
                  const typeInfo = MESSAGE_TYPE_COLORS[selectedMessage.type];
                  return <span className={`rounded-full px-3 py-1 text-xs ${typeInfo.bg} ${typeInfo.text}`}>{typeInfo.label}</span>;
                })()}
              </div>

              <h2 className="mb-4 text-2xl font-semibold text-gray-900">{selectedMessage.subject}</h2>

              <div className="mb-6 flex items-center gap-3 border-b border-gray-200 pb-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-500 font-semibold text-white">{selectedMessage.from[0]}</div>
                <div className="flex-1">
                  <div className="font-semibold text-gray-900">{selectedMessage.from}</div>
                  <div className="font-mono text-sm text-gray-500">{selectedMessage.fromAddress}</div>
                </div>
                <div className="text-sm text-gray-500">{selectedMessage.timestamp}</div>
              </div>

              <div className="max-w-none">
                <p className="mb-4 text-gray-700 leading-relaxed">{selectedMessage.preview}</p>

                <div className="mt-6 rounded-2xl bg-gray-50 p-4">
                  <div className="mb-3 text-sm font-semibold text-gray-900">{"\u4ea4\u6613\u8be6\u60c5"}</div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">{"\u7f51\u7edc"}</span>
                      <span className="font-medium">{selectedMessage.network}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-gray-600">{"\u53d1\u9001\u5730\u5740"}</span>
                      <span className="font-mono text-xs">{selectedMessage.fromAddress}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">{"\u65f6\u95f4"}</span>
                      <span className="font-medium">{selectedMessage.timestamp}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
