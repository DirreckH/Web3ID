import { createBrowserRouter, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Portfolio } from "./pages/Portfolio";
import { Profile } from "./pages/Profile";
import { TradingExchange } from "./pages/TradingExchange";
import { TransactionHistory } from "./pages/TransactionHistory";
import { CardWallet } from "./pages/CardWallet";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: CardWallet },
      { path: "mall", Component: TradingExchange },
      { path: "trade", element: <Navigate replace to="/mall" /> },
      { path: "market", element: <Navigate replace to="/mall" /> },
      { path: "profile", Component: Profile },
      { path: "history", Component: TransactionHistory },
      { path: "portfolio", Component: Portfolio },
      { path: "assets", element: <Navigate replace to="/mall" /> },
    ],
  },
]);
