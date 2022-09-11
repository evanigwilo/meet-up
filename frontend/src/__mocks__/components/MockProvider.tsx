// 👇 Apollo & Graphql
import { MockedProvider } from "@apollo/client/testing";
// 👇 React
import { ReactNode } from "react";
// 👇 React Router
import { BrowserRouter } from "react-router-dom";
// 👇 Styled Component
import { ThemeProvider } from "styled-components";
// 👇 Styles
import theme from "../../styles/Theme";
import GlobalStyle from "../../styles/GlobalStyle";
// 👇 Context
import { cache } from "../../providers/apollo";
import WsProvider from "../../providers/ws";

export default ({
  children,
  mocks,
}: {
  children: ReactNode;
  mocks?: typeof MockedProvider.defaultProps.mocks;
}) => (
  <MockedProvider mocks={mocks} cache={cache}>
    <WsProvider>
      <ThemeProvider theme={theme}>
        <BrowserRouter>
          <GlobalStyle />
          {children}
        </BrowserRouter>
      </ThemeProvider>
    </WsProvider>
  </MockedProvider>
);
