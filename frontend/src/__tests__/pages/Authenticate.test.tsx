// 👇 React Testing
import {
  cleanup,
  render,
  screen,
  act,
  fireEvent,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
// 👇 Pages
import Authenticate from "../../pages/Authenticate";
// 👇 Components
import MockProvider from "../../__mocks__/components/MockProvider";
// 👇 Constants, Helpers & Types
import * as helpers from "../../utils/helpers";
import { AuthCredentials, AuthRoute } from "../../utils/types";
import EventEmitter from "events";
import { genders, SEO } from "../../utils/constants";
import { trueFalse } from "../../__mocks__/utils/constants";
import { Mocks } from "../../__mocks__/utils/types";
import {
  createAuth,
  mockMutations,
  resolved,
  findTextContent,
  wait,
  findErrorText,
  findByAttribute,
} from "../../__mocks__/utils/helpers";

const mockUseNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockUseNavigate,
}));

const authMethods = ["Google", "Facebook"];

// 👇 mocked authentication window for OAuth authentication
class MockWindow extends EventEmitter {
  public focus: jest.Mock;
  public close: jest.Mock;
  public closed: boolean;
  public addEventListener: (
    type: "message" | "unload",
    listener: (ev?: MessageEvent<any>) => void
  ) => void;

  constructor(message: "success" | "failure") {
    super();
    this.close = jest.fn();
    this.focus = jest.fn();
    this.closed = false;
    this.addEventListener = (type, listener) => {
      if (type === "message") {
        this.addListener("message", listener);
      } else {
        this.addListener("open", listener);
      }
    };

    this.addEventListener("unload", () => {
      jest
        .spyOn(window, "addEventListener")
        .mockImplementationOnce((type, listener) => {
          if (type === "message") {
            this.addEventListener(
              type,
              listener as (ev?: MessageEvent<any>) => void
            );
          }
        });
      // 👇 on unload, return success authentication message
      Promise.resolve().then(() => {
        this.emit("message", { data: message });
      });
    });
  }
}

const renderComponent = async (
  mocks: Mocks,
  route: AuthRoute,
  authenticated = false
) => {
  // 👇 spy mocks
  const spyTestObserver = jest.spyOn(helpers, "testObserver").mockClear();
  const spyLocationReplace = jest.fn();
  jest.spyOn(helpers, "sleep").mockImplementation(resolved);
  jest.spyOn(window, "location", "get").mockReturnValue({
    ...window.location,
    replace: spyLocationReplace,
  });

  mockUseNavigate.mockClear();
  render(
    <MockProvider mocks={mocks}>
      <Authenticate route={route} />
    </MockProvider>
  );

  await wait(() => {
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    // 👇 get home link
    const homeLink = links[0];
    expect(homeLink).toHaveAttribute("href", "/");
    expect(homeLink).toHaveTextContent(SEO.title);
    // 👇 get username or email input
    const usernameOrEmail = screen.getByLabelText("Username");
    expect(usernameOrEmail).toHaveValue("");
    // 👇 get password input
    const passwordPlaceHolder = screen.getByText(findTextContent("Password"));
    const password = screen.getByLabelText("Password");
    expect(password).toHaveValue("");
    // 👇 get password visibility toggler
    const passwordVisibility = screen.getByText(findTextContent("Show"));
    expect(passwordPlaceHolder.nextSibling).toEqual(password);
    expect(password.nextSibling).toEqual(passwordVisibility);

    // 👇 get login/sign up button
    const submit = screen.getByDisplayValue(route);
    expect(submit).toBeVisible();
    expect(submit).toBeEnabled();
    expect(submit).toHaveAttribute("type", "submit");

    // 👇 test Login or Register route
    if (route === "Login") {
      const usernameOrEmailPlaceHolder = screen.getByText(
        findTextContent("Username or Email")
      );
      expect(usernameOrEmailPlaceHolder.nextSibling).toEqual(usernameOrEmail);
      // 👇 get sign up link
      const signUpLink = links[1];
      expect(signUpLink).toHaveAttribute("href", "/register");
      expect(signUpLink).toHaveTextContent("Sign Up");
      // 👇 OAuth 2 methods for authentication should be visible on login page
      authMethods.forEach((auth) => {
        const element = screen.getByText(
          findTextContent(" Sign in with " + auth)
        );
        expect(element).toBeVisible();
        // 👇 auth method should have an image for its type
        expect(element.previousElementSibling?.tagName.toLowerCase()).toEqual(
          "img"
        );
      });
    } else {
      const usernamePlaceHolder = screen.getByText(findTextContent("Username"));
      expect(usernamePlaceHolder.nextSibling).toEqual(usernameOrEmail);
      // 👇 get login link
      const loginLink = links[1];
      expect(loginLink).toHaveAttribute("href", "/login");
      expect(loginLink).toHaveTextContent("Login");
      // 👇 get full name
      const fullNamePlaceHolder = screen.getByText(
        findTextContent("Full Name")
      );
      const fullName = screen.getByLabelText("Full Name");
      expect(fullName).toHaveValue("");
      expect(fullNamePlaceHolder.nextSibling).toEqual(fullName);
      // 👇 get email
      const emailPlaceHolder = screen.getByText(findTextContent("Email"));
      const email = screen.getByLabelText("Email address");
      expect(email).toHaveValue("");
      expect(emailPlaceHolder.nextSibling).toEqual(email);
      // 👇 get gender input
      const genderPlaceHolder = screen.getByText(findTextContent("Gender"));
      const gender = screen.getByText(
        findByAttribute("input", "name", "gender")
      );
      expect(gender).toHaveValue(genders[0]); // Male
      // 👇 get gender toggler
      const genderToggle = screen.getByText(findTextContent("⇩"));
      expect(genderPlaceHolder.nextSibling).toEqual(gender);
      expect(gender.nextSibling).toEqual(genderToggle);
      // 👇 get bio
      const bioPlaceHolder = screen.getByText(findTextContent("Bio"));
      const bio = screen.getByRole(findByAttribute("textarea", "name", "bio"));
      expect(bio).toHaveValue("");
      expect(bioPlaceHolder.nextSibling).toEqual(bio);
    }
  });
  // 👇 login/sign mutation should not have been called
  expect(spyTestObserver).not.toHaveBeenCalledWith(route);

  // 👇 should try navigating to homepage if user is already authenticated and user is in login route
  if (authenticated) {
    expect(mockUseNavigate).toHaveBeenCalledTimes(1);
    expect(mockUseNavigate).toHaveBeenCalledWith("/", expect.any(Object));
  } else {
    expect(mockUseNavigate).toHaveBeenCalledTimes(0);
  }
  // 👇 no location replace to homepage after successful authentication
  expect(spyLocationReplace).toHaveBeenCalledTimes(0);

  // 👇 clean up a mock's usage data between two assertions
  spyTestObserver.mockClear();
  mockUseNavigate.mockClear();

  return {
    spyTestObserver,
    spyLocationReplace,
  };
};

describe("Authenticate", () => {
  afterEach(() => {
    // 👇 unmounts react trees that were mounted with render.
    cleanup();
  });

  it("should render component", async () => {
    for (const route of ["Sign Up", "Login"] as AuthRoute[]) {
      for (const authenticated of trueFalse) {
        // 👇 defining mocked responses for user authenticated status
        const mocks = [createAuth(authenticated)];
        // 👇 render and test component based on route
        await renderComponent(mocks, route, authenticated);
        // 👇 unmounts react trees that were mounted with render.
        cleanup();
      }
    }
  });

  it("should show password with password visibility toggle", async () => {
    const route = "Login";
    const authenticated = false;
    // 👇 define mocked response
    const mocks = [createAuth(false)];
    // 👇 render and test component
    await renderComponent(mocks, route, authenticated);
    // 👇 get password input
    const password = screen.getByLabelText("Password");
    expect(password).toHaveAttribute("type", "password");
    // 👇 get password visibility toggler
    const passwordVisibility = screen.getByText(findTextContent("Show"));
    // 👇 trigger show password
    fireEvent.click(passwordVisibility);
    await wait(() => {
      // 👇 password should be visible
      expect(password).toHaveAttribute("type", "text");
    });
  });

  it("should toggle available gender selector", async () => {
    const route = "Sign Up";
    const authenticated = false;
    // 👇 define mocked response
    const mocks = [createAuth(false)];
    // 👇 render and test component
    await renderComponent(mocks, route, authenticated);
    // 👇 get gender inputs
    let gender = screen.getByText(findByAttribute("input", "name", "gender"));
    expect(gender).toHaveValue(genders[0]); // Male
    const genderToggle = screen.getByText(findTextContent("⇩"));
    const genderSelector = genderToggle.nextSibling;
    // 👇 style for 90 degrees rotation not viewable and also not active
    const hiddenStyle = {
      "--angle": "90deg",
      "--pointer": "none",
    };
    expect(genderSelector).toHaveStyle(hiddenStyle);
    // 👇 click gender toggler
    fireEvent.click(genderToggle);
    await wait(() => {
      // 👇 style for no rotation and also active for selection
      expect(genderSelector).toHaveStyle({
        "--angle": "0deg",
        "--pointer": "unset",
      });
    });
    const femaleGender = screen.getByText(findTextContent(genders[1])); // Female
    // 👇 changer gender
    fireEvent.click(femaleGender);
    await wait(() => {
      // 👇 gender selection should have changed
      gender = screen.getByText(findByAttribute("input", "name", "gender"));
      expect(gender).toHaveValue(genders[1]); // Female
    });
    // 👇 click gender toggler should not be viewable or active
    expect(genderSelector).toHaveStyle(hiddenStyle);
  });

  it("should sign up a user with password authentication", async () => {
    const route = "Sign Up";
    const success: Required<Omit<AuthCredentials, "usernameOrEmail">> = {
      username: "user",
      password: "123456",
      name: "The User",
      gender: "male",
      email: "user@user.com",
      bio: "",
    };
    const credentials = {
      success,
      failure: {
        ...success,
        username: "user@",
      },
      error: "Username should contain only letters and numbers.",
    };
    const mocks = [
      createAuth(false),
      mockMutations.register(credentials.success),
      mockMutations.register(credentials.failure, credentials.error),
    ];
    // 👇 render and test component
    const { spyTestObserver, spyLocationReplace } = await renderComponent(
      mocks,
      route
    );
    // 👇 no error message should be present
    let usernameError = screen.queryByText(findErrorText("Username"));
    let passwordError = screen.queryByText(findErrorText("Password"));
    let emailError = screen.queryByText(findErrorText("Email"));
    expect(usernameError || passwordError || emailError).toBeNull();
    // 👇 get sign up button
    let signUp = screen.getByDisplayValue(route);
    // 👇 trigger sign up click
    fireEvent.click(signUp);
    await wait(() => {
      // 👇 error should be shown for empty fields
      usernameError = screen.getByText(findErrorText("Username"));
      passwordError = screen.getByText(findErrorText("Password"));
      emailError = screen.getByText(findErrorText("Email"));
      expect(usernameError).toBeVisible();
      expect(passwordError).toBeVisible();
      expect(emailError).toBeVisible();
    });
    // 👇 sign up mutation should not have been called
    expect(spyTestObserver).toHaveBeenCalledTimes(0);
    expect(spyTestObserver).not.toHaveBeenCalledWith(route);

    // 👇 get inputs
    const username = screen.getByLabelText("Username");
    const password = screen.getByLabelText("Password");
    const fullName = screen.getByLabelText("Full Name");
    const email = screen.getByLabelText("Email address");
    // 👇 simulate typing failure sign up credentials
    userEvent.type(username, credentials.failure.username);
    userEvent.type(password, credentials.failure.password);
    userEvent.type(fullName, credentials.failure.name);
    userEvent.type(email, credentials.failure.email);
    await wait(() => {
      // 👇 input values should have changed
      expect(username).toHaveValue(credentials.failure.username);
      expect(password).toHaveValue(credentials.failure.password);
      expect(fullName).toHaveValue(credentials.failure.name);
      expect(email).toHaveValue(credentials.failure.email);
      // 👇 no error message should be present
      usernameError = screen.queryByText(findErrorText("Username"));
      passwordError = screen.queryByText(findErrorText("Password"));
      emailError = screen.queryByText(findErrorText("Email"));
      expect(usernameError || passwordError || emailError).toBeNull();
    });
    // 👇 no error message from server
    let serverError = screen.queryByText(findErrorText(credentials.error));
    expect(serverError).toBeNull();
    // 👇 trigger sign up click
    fireEvent.click(signUp);
    await wait(() => {
      // 👇 server error message should be present
      serverError = screen.getByText(findErrorText(credentials.error));
      expect(serverError).toBeVisible();
    });
    // 👇 sign up mutation should have been called
    expect(spyTestObserver).toHaveBeenCalledTimes(1);
    expect(spyTestObserver).toHaveBeenCalledWith(route);
    spyTestObserver.mockClear();
    // 👇 no location replace to homepage after authentication
    expect(spyLocationReplace).toHaveBeenCalledTimes(0);

    // 👇 simulate clearing in inputs
    userEvent.clear(username);
    userEvent.clear(password);
    userEvent.clear(fullName);
    userEvent.clear(email);
    // 👇 simulate typing success sign up credentials
    userEvent.type(username, credentials.success.username);
    userEvent.type(password, credentials.success.password);
    userEvent.type(fullName, credentials.success.name);
    userEvent.type(email, credentials.success.email);
    await wait(() => {
      // 👇 input values should have changed
      expect(username).toHaveValue(credentials.success.username);
      expect(password).toHaveValue(credentials.success.password);
      expect(fullName).toHaveValue(credentials.success.name);
      expect(email).toHaveValue(credentials.success.email);
    });
    signUp = screen.getByDisplayValue(route);
    // 👇 trigger sign up click
    fireEvent.click(signUp);
    await wait(() => {
      // 👇 sign up mutation should have been called
      expect(spyTestObserver).toHaveBeenCalledTimes(1);
      expect(spyTestObserver).toHaveBeenCalledWith(route);
      // 👇 navigate to homepage after successful authentication
      expect(spyLocationReplace).toHaveBeenCalledTimes(1);
      expect(spyLocationReplace).toHaveBeenCalledWith("/");
    });
  });

  it("should login a user with password authentication", async () => {
    const route = "Login";
    const credentials = {
      success: { usernameOrEmail: "user", password: "123456" },
      failure: {
        usernameOrEmail: "user",
        password: "123",
      },
      error: "Username or Email doesn't exist.",
    };
    const mocks = [
      createAuth(false),
      mockMutations.login(credentials.success),
      mockMutations.login(credentials.failure, credentials.error),
    ];
    // 👇 render and test component
    const { spyTestObserver, spyLocationReplace } = await renderComponent(
      mocks,
      route
    );
    // 👇 no error message should be present
    let usernameOrEmailError = screen.queryByText(
      findErrorText("Username or Email")
    );
    let passwordError = screen.queryByText(findErrorText("Password"));
    expect(usernameOrEmailError || passwordError).toBeNull();

    // 👇 get login button
    let login = screen.getByDisplayValue(route);
    // 👇 trigger login click
    fireEvent.click(login);
    await wait(() => {
      // 👇 error should be shown for empty fields
      usernameOrEmailError = screen.getByText(
        findErrorText("Username or Email")
      );
      passwordError = screen.getByText(findErrorText("Password"));
      expect(usernameOrEmailError).toBeVisible();
      expect(passwordError).toBeVisible();
    });
    // 👇 login mutation should not have been called
    expect(spyTestObserver).toHaveBeenCalledTimes(0);
    expect(spyTestObserver).not.toHaveBeenCalledWith(route);

    // 👇 get username or email input
    const usernameOrEmail = screen.getByLabelText("Username");
    // 👇 get password input
    const password = screen.getByLabelText("Password");
    // 👇 simulate typing failure login credentials
    userEvent.type(usernameOrEmail, credentials.failure.usernameOrEmail);
    userEvent.type(password, credentials.failure.password);
    await wait(() => {
      // 👇 input values should have changed
      expect(usernameOrEmail).toHaveValue(credentials.failure.usernameOrEmail);
      expect(password).toHaveValue(credentials.failure.password);
      // 👇 no error message should be present
      usernameOrEmailError = screen.queryByText(
        findErrorText("Username or Email")
      );
      passwordError = screen.queryByText(findErrorText("Password"));
      expect(usernameOrEmailError || passwordError).toBeNull();
    });
    // 👇 no error message from server
    let serverError = screen.queryByText(findErrorText(credentials.error));
    expect(serverError).toBeNull();
    // 👇 trigger login click
    fireEvent.click(login);
    await wait(() => {
      // 👇 server error message should be present
      serverError = screen.getByText(findErrorText(credentials.error));
      expect(serverError).toBeVisible();
    });
    // 👇 login mutation should have been called
    expect(spyTestObserver).toHaveBeenCalledTimes(1);
    expect(spyTestObserver).toHaveBeenCalledWith(route);
    spyTestObserver.mockClear();
    // 👇 no location replace to homepage after authentication
    expect(spyLocationReplace).toHaveBeenCalledTimes(0);

    // 👇 simulate clearing in inputs
    userEvent.clear(usernameOrEmail);
    userEvent.clear(password);
    // 👇 simulate typing success login credentials
    userEvent.type(usernameOrEmail, credentials.success.usernameOrEmail);
    userEvent.type(password, credentials.success.password);
    await wait(() => {
      // 👇 input values should have changed
      expect(usernameOrEmail).toHaveValue(credentials.success.usernameOrEmail);
      expect(password).toHaveValue(credentials.success.password);
    });
    login = screen.getByDisplayValue(route);
    // 👇 trigger login click
    fireEvent.click(login);
    await wait(() => {
      // 👇 login mutation should have been called
      expect(spyTestObserver).toHaveBeenCalledTimes(1);
      expect(spyTestObserver).toHaveBeenCalledWith(route);
      // 👇 navigate to homepage after successful authentication
      expect(spyLocationReplace).toHaveBeenCalledTimes(1);
      expect(spyLocationReplace).toHaveBeenCalledWith("/");
    });
  });

  it("should login a user with OAuth 2 authentication", async () => {
    const route = "Login";
    const mocks = [createAuth(false)];
    // 👇 render and test component
    const { spyLocationReplace } = await renderComponent(mocks, route);
    // 👇 fake timers for manually advancing intervals
    jest.useFakeTimers();
    const spyClearInterval = jest.spyOn(window, "clearInterval");
    // 👇 define mocked window for successful authentication
    let authTab = new MockWindow("success");
    let spyAuthTabClose = jest.spyOn(authTab, "close");
    let spyAuthTabAddListener = jest.spyOn(authTab, "addEventListener");
    jest
      .spyOn(window, "open")
      .mockReturnValueOnce(authTab as unknown as Window);
    // 👇 get auth button by using google auth
    let authGoogle = screen.getByTestId("auth-Google");
    // 👇 trigger auth button click
    fireEvent.click(authGoogle);
    await wait(() => {
      // 👇 added unload event handler
      expect(spyAuthTabAddListener).toHaveBeenCalledTimes(1);
    });
    // 👇 trigger unload event which returns success authentication message
    authTab.emit("open");
    await wait(() => {
      // 👇 added message event handler
      expect(spyAuthTabAddListener).toHaveBeenCalledTimes(2);
    });
    // 👇 navigate to homepage after successful authentication
    expect(spyLocationReplace).toHaveBeenCalledTimes(1);
    expect(spyLocationReplace).toHaveBeenCalledWith("/");
    // 👇 mocked window should be closed after authentication
    expect(spyAuthTabClose).toHaveBeenCalledTimes(1);
    expect(spyClearInterval).toHaveBeenCalledTimes(0);
    await act(async () => {
      // 👇 advance interval for checking closed tab for cross origin popups
      authTab.closed = true;
      jest.advanceTimersByTime(helpers.secsToMs(0.5));
    });
    // 👇 mocked window should be closed after interval is cleared
    expect(spyClearInterval).toHaveBeenCalledTimes(1);

    // 👇 clean up a mock's usage data between assertions
    spyLocationReplace.mockClear();
    spyClearInterval.mockClear();
    // 👇 no error message should be present
    let OAuthError = screen.queryByText(findErrorText("OAuth 2.0"));
    expect(OAuthError).toBeNull();
    // 👇 define mocked window for failed authentication
    authTab = new MockWindow("failure");
    spyAuthTabClose = jest.spyOn(authTab, "close");
    spyAuthTabAddListener = jest.spyOn(authTab, "addEventListener");
    jest
      .spyOn(window, "open")
      .mockReturnValueOnce(authTab as unknown as Window);
    // 👇 trigger auth button click
    fireEvent.click(authGoogle);
    await wait(() => {
      // 👇 added unload event handler
      expect(spyAuthTabAddListener).toHaveBeenCalledTimes(1);
    });
    // 👇 trigger unload event which returns failed authentication message
    authTab.emit("open");
    await wait(() => {
      // 👇 added message event handler
      expect(spyAuthTabAddListener).toHaveBeenCalledTimes(2);
    });
    // 👇 no location replace to homepage after authentication
    expect(spyLocationReplace).toHaveBeenCalledTimes(0);
    // 👇 mocked window should be closed after authentication
    expect(spyAuthTabClose).toHaveBeenCalledTimes(1);
    expect(spyClearInterval).toHaveBeenCalledTimes(0);
    await act(async () => {
      // 👇 advance interval for checking closed tab for cross origin popups
      authTab.closed = true;
      jest.advanceTimersByTime(helpers.secsToMs(0.5));
    });
    // 👇 mocked window should be closed after interval is cleared
    expect(spyClearInterval).toHaveBeenCalledTimes(1);
    OAuthError = screen.queryByText(findErrorText("OAuth 2.0"));
    // 👇 error should be shown for failed authentication
    expect(OAuthError).toBeVisible();
  });
});
