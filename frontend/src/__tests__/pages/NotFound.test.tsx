// 👇 React Testing
import { cleanup, render, screen } from "@testing-library/react";
// 👇 Pages
import NotFound from "../../pages/NotFound";
// 👇 Components
import MockProvider from "../../__mocks__/components/MockProvider";
// 👇 Constants, Helpers & Types
import { createAuth, findTextContent } from "../../__mocks__/utils/helpers";

describe("Not Found", () => {
  beforeEach(() => {
    render(
      <MockProvider mocks={[createAuth()]}>
        <NotFound />
      </MockProvider>
    );
  });
  afterEach(() => {
    // 👇 unmounts React trees that were mounted with render.
    cleanup();
  });

  it("should render components", async () => {
    // 👇 get 404 message
    const notFoundMessage = screen.getByText(
      findTextContent("Sorry, this page isn't available.")
    );
    expect(notFoundMessage).toBeVisible();
    // 👇 get home link
    const homeLink = screen.getByRole("link");
    expect(homeLink).toHaveAttribute("href", "/");
  });
});
