import { createBrowserRouter } from "react-router-dom";

import { App } from "./App";
import ListenScreen from "../screens/ListenScreen";
import SearchScreen from "../screens/SearchScreen";
import LibraryScreen from "../screens/LibraryScreen";
import QueuesScreen from "../screens/QueuesScreen";
import KalamScreen from "../screens/KalamScreen";
import RenditionScreen from "../screens/RenditionScreen";
import PersonScreen from "../screens/PersonScreen";
import CollectionScreen from "../screens/CollectionScreen";
import AccountScreen from "../screens/AccountScreen";
import AuthScreen from "../screens/AuthScreen";
import StudioScreen from "../screens/StudioScreen";
import IntakeScreen from "../screens/IntakeScreen";
import TranscribeScreen from "../screens/TranscribeScreen";
import TimingScreen from "../screens/TimingScreen";
import TranslateScreen from "../screens/TranslateScreen";
import ContextScreen from "../screens/ContextScreen";
import SubmissionsScreen from "../screens/SubmissionsScreen";
import RequestsScreen from "../screens/RequestsScreen";
import RequestScreen from "../screens/RequestScreen";
import MirrorsScreen from "../screens/MirrorsScreen";
import AdminScreen from "../screens/AdminScreen";
import AdminReviewScreen from "../screens/AdminReviewScreen";
import RendersScreen from "../screens/RendersScreen";
import PublishScreen from "../screens/PublishScreen";
import NotFound from "../screens/NotFound";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <ListenScreen /> },
      { path: "search", element: <SearchScreen /> },
      { path: "library", element: <LibraryScreen /> },
      { path: "queues", element: <QueuesScreen /> },
      { path: "kalam/:slug", element: <KalamScreen /> },
      { path: "rendition/:slug", element: <RenditionScreen /> },
      { path: "person/:slug", element: <PersonScreen /> },
      { path: "collection/:slug", element: <CollectionScreen /> },
      { path: "account", element: <AccountScreen /> },
      { path: "auth", element: <AuthScreen /> },
      { path: "studio", element: <StudioScreen /> },
      { path: "studio/intake", element: <IntakeScreen /> },
      { path: "studio/transcribe/:slug", element: <TranscribeScreen /> },
      { path: "studio/timing/:slug", element: <TimingScreen /> },
      { path: "studio/translate/:slug", element: <TranslateScreen /> },
      { path: "studio/context/:slug", element: <ContextScreen /> },
      { path: "studio/submissions", element: <SubmissionsScreen /> },
      { path: "requests", element: <RequestsScreen /> },
      { path: "request", element: <RequestScreen /> },
      { path: "mirrors", element: <MirrorsScreen /> },
      { path: "admin", element: <AdminScreen /> },
      { path: "admin/review", element: <AdminReviewScreen /> },
      { path: "admin/renders", element: <RendersScreen /> },
      { path: "admin/publish", element: <PublishScreen /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);
