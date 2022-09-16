// 👇 React
import { useLayoutEffect, useState } from "react";
// 👇 React Router
import { Routes, Route, useLocation } from "react-router-dom";
// 👇 Styled Component
import styled from "styled-components";
// 👇 Components
import Header from "./components/Header";
// 👇 Pages
import Home from "./pages/Home";
import Profile from "./pages/Profile";
import Authenticate from "./pages/Authenticate";
import PostDetails from "./pages/PostDetails";
import NotFound from "./pages/NotFound";
// 👇 Styles
import { CalligraffittiCSS } from "./styles/Font";
import { KeyValue, Store } from "./utils/types";
import { useStore } from "./providers/context";
import { SEO } from "./utils/constants";

const Modal = styled.div<{
  prop: Store["modal"];
}>`
  @keyframes animScale {
    0% {
      transform: scale(1);
    }
    100% {
      transform: scale(1.5);
    }
  }

  cursor: progress;
  pointer-events: ${({ prop }) => (prop?.disabled ? "none" : "unset")};
  opacity: ${({ prop }) => (prop?.visible ? "1" : "0")};
  width: 100%;
  height: 100%;
  left: 0;
  z-index: 3;
  position: fixed;
  color: white;
  transition: opacity 0.5s;
  background-color: black;
  display: grid;
  place-items: center;
  &:before {
    content: ${({ prop }) => (prop?.logo ? `"${SEO.logo}"` : '""')};
    text-shadow: 0px 1px 3px white;
    font-size: 10vh;
    animation: animScale 1s infinite alternate;
  }
  &:after {
    ${CalligraffittiCSS}
    content: ${({ prop }) => (prop?.text ? `"${SEO.title}"` : '""')};
    position: inherit;
    font-size: xx-large;
    bottom: 1em;
    left: 50%;
    transform: translateX(-50%);
  }
`;

const Padding = styled.div`
  padding: 0 0.5em;
`;

const paths = {
  "*": <NotFound />,
  "/": <Home />,
  "/messenger": <Home />,
  "/post/:postId": <PostDetails />,
  "/reply/:replyId": <PostDetails />,
  "/login": <Authenticate route="Login" />,
  "/register": <Authenticate route="Sign Up" />,
  "/user/:auth/:username": <Profile />,
};

const authPageTitle =
  `Login | Sign in to ${SEO.title} to see the latest. ` +
  "Join the conversation, follow accounts, see your Home Timeline, and catch up on Posts from the people you know.";

const titles: Record<keyof typeof paths, string> = {
  "*": SEO.title,
  "/":
    `Explore / ${SEO.title}. ` +
    "A simple, fun & creative way to capture, edit & share photos, videos & messages with friends & family.",
  "/register": authPageTitle,
  "/login": authPageTitle,
  "/messenger":
    "Hang out wherever, whenever!. Messenger makes it easy and fun to stay close to your favorite people.",
  "/post/:postId": SEO.title,
  "/reply/:replyId": SEO.title,
  "/user/:auth/:username": SEO.title,
};

const generateRoutes = () => {
  const routes: JSX.Element[] = [];

  for (let _path in paths) {
    const path = _path as keyof typeof paths;
    const element =
      path === "/login" ||
      path === "/register" ||
      path === "/user/:auth/:username" ? (
        <>{paths[path]}</>
      ) : (
        <>
          <Header messenger={path === "/messenger"} />
          {path === "*" ? paths[path] : <Padding>{paths[path]}</Padding>}
        </>
      );
    routes.push(<Route key={path} path={path} element={element} />);
  }
  return routes;
};

const App = () => {
  const { modal } = useStore();
  const location = useLocation();
  const [routes] = useState(generateRoutes());

  useLayoutEffect(() => {
    document.title = (titles as KeyValue)[location.pathname] || SEO.title;
  }, [location]);

  return (
    <>
      <Modal prop={modal} />
      <Routes>{routes}</Routes>
    </>
  );
};

export default App;
