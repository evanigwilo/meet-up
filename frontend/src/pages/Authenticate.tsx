// 👇 React
import {
  useState,
  useEffect,
  useRef,
  useLayoutEffect,
  useCallback,
} from "react";
// 👇 React Router
import { useLocation, useNavigate } from "react-router-dom";
// 👇 Styled Component
import styled, { css, useTheme } from "styled-components";
// 👇 React Hook Form & Validators
import { useForm, SubmitHandler } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { object, string, mixed } from "yup";
// 👇 Styles
import { Text, Error } from "../styles/Text";
import { HoverCSS } from "../styles/Interactions";
import { Flex, ToolTip } from "../styles/Containers";
import { CalligraffittiCSS } from "../styles/Font";
import { InputCSS } from "../styles/Input";
import DashedBorder from "../styles/DashedBorder";
import { Anchor } from "../styles/Anchor";
// 👇 Components
import { Spinner } from "../components/Loader";
// 👇 Custom hooks
import { USE_MUTATION } from "../hooks/useApollo";
import { useReference } from "../hooks/useReference";
// 👇 Context
import { useStore, useDispatch } from "../providers/context";
// 👇 Images
import facebook from "../images/OAuth/facebook.svg";
import google from "../images/OAuth/google.svg";
// 👇 Constants, Helpers & Types
import { ActionType } from "../utils/types/enum";
import {
  AuthCredentials,
  AuthRoute,
  InputElement,
  UserType,
} from "../utils/types";
import {
  apiUrl,
  secsToMs,
  testObserver,
  updateProperty,
  updateStyle,
} from "../utils/helpers";
import {
  genders,
  REACT_APP_SERVER_API_VERSION,
  REACT_APP_SERVER_PATH,
  SEO,
} from "../utils/constants";

const maxLength = 256;

const characterLimitMessage = (key: string, length: number) =>
  `${key} must be at least ${length} characters.`;

// 👇 register schema for form
const registerSchema = object({
  name: string()
    .min(3, characterLimitMessage("Full Name", 3))
    .required(characterLimitMessage("Full Name", 3)),
  email: string().email("Email is not valid.").required("Email is not valid."),
  username: string()
    .min(3, characterLimitMessage("Username", 3))
    .required(characterLimitMessage("Username", 3)),
  password: string()
    .min(6, characterLimitMessage("Password", 6))
    .required(characterLimitMessage("Password", 6)),
  gender: mixed<typeof genders[number]>()
    .oneOf<string>(genders)
    .default(genders[0]),
  bio: string().max(maxLength, `Bio cannot exceed ${maxLength} characters.`),
});

// 👇 login schema for form
const loginSchema = object({
  usernameOrEmail: string().required("Username or Email is not valid."),
  password: string().required("Password is not valid."),
});

const Container = styled(Flex)`
  flex-direction: column;
  text-align: center;
  top: 10vh;
  max-width: 375px;
  width: calc(100vw - 1em);
  margin: auto;
`;

const Calligraphy = styled(Text)`
  ${CalligraffittiCSS}
  white-space: nowrap;
`;

const Status = styled(Text)`
  opacity: ${({ theme }) => theme.opacity.dim};
  position: absolute;
  right: 1em;
  height: 100%;
  display: flex;
  align-items: center;
  cursor: pointer;
`;

const TextInput = styled.input<{ sub?: boolean; capitalize?: boolean }>`
  ${InputCSS};
  text-transform: ${({ capitalize }) => capitalize && "capitalize"};
  ${({ sub }) =>
    sub &&
    css`
      border-top-width: 1.5em;
      border-bottom-width: 0.5em;
    `}
`;

const BioInput = styled.textarea`
  ${InputCSS};
  resize: none;
  height: auto;
`;

const Submit = styled.input`
  ${InputCSS};
  ${HoverCSS};
  background: unset;
  border-radius: unset;
`;

const PlaceHolder = styled(Text)<{ sub?: boolean }>`
  position: absolute;
  pointer-events: none;
  left: 1em;
  margin-top: 1em;
  transition: all 0.1s;
  opacity: ${({ theme }) => theme.opacity.dim};
  ${({ sub }) =>
    sub &&
    css`
      left: 1.125em;
      margin-top: 0.5em;
      font-size: smaller;
    `}
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  height: 100%;
  width: 100%;

  // 👇 all form first children except last child
  & > div:not(:last-child) {
    margin-bottom: 1em;
  }
`;

// 👇 update autofill color styles helper
const setAutoFillColor = (currentTarget: InputElement) => {
  const placeHolder = currentTarget.previousSibling as HTMLSpanElement;

  const color = window
    .getComputedStyle(currentTarget)
    .getPropertyValue("color");

  updateStyle(placeHolder, {
    color,
  });

  if (placeHolder.textContent === "Password") {
    updateStyle(currentTarget.nextSibling, {
      color,
    });
  }
};

const onChange: React.FormEventHandler<InputElement> = ({ currentTarget }) => {
  if (currentTarget.value) {
    onFocus({ currentTarget } as React.FocusEvent<InputElement>);
  } else {
    onBlur({ currentTarget } as React.FocusEvent<InputElement>);
  }
};

const onFocus: React.FocusEventHandler<InputElement> = ({ currentTarget }) => {
  setAutoFillColor(currentTarget);

  const placeHolder = currentTarget.previousSibling;

  updateStyle(placeHolder, {
    left: "1.125em",
    marginTop: "0.5em",
    fontSize: "smaller",
  });

  updateStyle(currentTarget, {
    borderTopWidth: "1.5em",
    borderBottomWidth: "0.5em",
  });
};

const onBlur: React.FocusEventHandler<InputElement> = ({ currentTarget }) => {
  setAutoFillColor(currentTarget);

  if (currentTarget.value) {
    return;
  }

  const placeHolder = currentTarget.previousSibling as HTMLSpanElement;

  updateStyle(placeHolder, {
    left: "1.125em",
    marginTop: "1em",
    fontSize: "",
  });

  updateStyle(currentTarget, {
    borderTopWidth: "",
    borderBottomWidth: "",
  });
};

const Authenticate = ({ route }: { route: AuthRoute }) => {
  const theme = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const { authenticating, user } = useStore();
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(true);
  const [OAuthError, setOAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState("");
  const genderContainer = useRef<HTMLDivElement | null>(null);
  const authCloseInterval = useReference(0);
  const genderSelected = useReference(0);
  const {
    register,
    handleSubmit,
    setValue,
    clearErrors,
    resetField,
    formState: { errors },
  } = useForm<AuthCredentials>({
    resolver: yupResolver(route === "Sign Up" ? registerSchema : loginSchema),
  });

  const LOGIN = USE_MUTATION<UserType>("login");
  const REGISTER = USE_MUTATION<UserType>("register");

  const AuthButton = useCallback(
    (auth: "Google" | "Facebook") => (
      <ToolTip
        data-testid={`auth-${auth}`}
        border={{
          radius: "1.5em",
        }}
        width="100%"
        height="3em"
        align="center"
        justify="center"
        padding="0"
        onClick={() => {
          setOAuthError("");
          setAuthLoading(auth);

          // 👇 new window in production had no window.opener
          if (REACT_APP_SERVER_PATH === "/api") {
            window.location.replace(
              `${REACT_APP_SERVER_PATH}${REACT_APP_SERVER_API_VERSION}` +
                "/auth/" +
                auth
            );
            return;
          }

          const height = Math.min(window.screen.height, 640);
          const width = Math.min(window.screen.width, 480);
          // 👇 Allow for borders.
          const leftPosition = window.screen.width / 2 - (width / 2 + 10);
          // 👇 Allow for title and status bars.
          const topPosition = window.screen.height / 2 - (height / 2 + 50);
          // 👇 open resizable tab for OAuth authentication
          const authTab = window.open(
            apiUrl() + "/auth/" + auth,
            "_self",
            "status=no,resizable=no,toolbar=no,menubar=no," +
              "scrollbars=yes,directories=no,height=" +
              height +
              ",width=" +
              width +
              ",left=" +
              leftPosition +
              ",top=" +
              topPosition +
              ",screenX=" +
              leftPosition +
              ",screenY=" +
              topPosition
          );
          authTab?.addEventListener("unload", () => {
            authTab?.focus();

            // 👇 solution for checking closed tab for cross origin popups, check on interval
            authCloseInterval.update(
              window.setInterval(() => {
                if (authTab?.closed) {
                  window.clearInterval(authCloseInterval.value);
                  setAuthLoading("");
                }
              }, secsToMs(0.5))
            );

            const messageEvent = ({ data }: MessageEvent<any>) => {
              window.removeEventListener("message", messageEvent);
              if (data === "success") {
                // 👇 forces reload so as to load websocket from ws context
                window.location.replace("/");
              } else {
                setOAuthError("OAuth 2.0 Authorization failed.");
              }
              authTab?.close();
            };

            window.addEventListener("message", messageEvent);
          });
        }}
      >
        {authLoading === auth ? (
          <Spinner />
        ) : (
          <>
            <img
              alt={auth}
              src={auth === "Google" ? google : facebook}
              width={auth === "Google" ? "20px" : "25px"}
            />
            <Text>&nbsp;{`Sign in with ${auth}`}</Text>
          </>
        )}
      </ToolTip>
    ),
    [authLoading]
  );

  const toggleGenderSelector = useCallback(() => {
    const selector = genderContainer.current;
    const angle = selector?.style.getPropertyValue("--angle");
    const is90deg = angle === "90deg";
    updateProperty(selector, {
      "--angle": is90deg ? "0deg" : "90deg",
      "--pointer": is90deg ? "unset" : "none",
    });
  }, []);

  // 👇 form submit handler
  const onSubmit: SubmitHandler<AuthCredentials> = useCallback(
    async (input) => {
      // 👇 clear OAuth error
      setOAuthError("");

      dispatch(ActionType.AUTHENTICATING);

      const { usernameOrEmail, username, name, email, gender, bio, password } =
        input;

      testObserver(route);
      const { data, errors } =
        route === "Sign Up"
          ? await REGISTER.mutate({
              variables: {
                userInput: {
                  username,
                  password,
                  name,
                  gender,
                  email,
                  bio,
                },
              },
            })
          : await LOGIN.mutate({
              variables: {
                usernameOrEmail,
                password,
              },
            });

      if (errors) {
        dispatch(ActionType.AUTHENTICATED, undefined);
      } else {
        const query = route === "Sign Up" ? REGISTER.query : LOGIN.query;
        if (data?.[query]) {
          // 👇 forces reload so as to load websocket from ws context
          window.location.replace("/");
        }
      }
    },
    [route]
  );

  // 👇 initial page load gender selector setup
  useLayoutEffect(() => {
    if (loading || route !== "Sign Up") {
      return;
    }

    toggleGenderSelector();

    updateProperty(genderContainer.current, {
      "transform-origin": "top",
      "pointer-events": "var(--pointer)",
      transform: "perspective(20cm) rotateX(var(--angle))",
      transition: "transform 0.25s linear 0.25s",
    });

    updateStyle(genderContainer.current?.childNodes[genderSelected.value], {
      backgroundColor: "var(--hoverColor)",
    });
  }, [loading, route]);

  useLayoutEffect(() => {
    if (!user) {
      return;
    }
    /* 
        Redirect them to the home page, but save the current location they were
        trying to go to when they were redirected. This allows us to send them
        along to that page after they login, which is a nicer user experience
        than dropping them off on the home page.
      */

    // 👇 replace login or register route with home page if user is authenticated
    navigate("/", {
      replace: true,
      state: { from: location },
    });
  }, [user]);

  useEffect(() => {
    // 👇 clear form errors
    clearErrors();

    const fields =
      route === "Sign Up" ? registerSchema.fields : loginSchema.fields;
    for (const field in fields) {
      const key = field as keyof AuthCredentials;
      // 👇 reset form inputs to default values
      resetField(key);
    }

    // 👇 reset selected gender option style
    updateStyle(genderContainer.current?.childNodes[genderSelected.value], {
      backgroundColor: "",
    });

    // 👇 reset selected gender option value
    genderSelected.update(0);

    // 👇 reset gender option to default value
    setValue("gender", genders[0]);

    // 👇 finished loading UI
    setLoading(false);

    // 👇 reset form, error and clear intervals on unmount
    return () => {
      route === "Sign Up" ? REGISTER.reset() : LOGIN.reset();
      setOAuthError("");
      window.clearInterval(authCloseInterval.value);
    };
  }, [route]);

  return (
    <Container>
      <Flex
        border
        direction="column"
        padding="1em"
        justify="space-between"
        height="100%"
        align="center"
        index={1}
      >
        <Anchor to={"/"}>
          <Calligraphy font="x-large" bold>
            {SEO.title}
          </Calligraphy>
        </Anchor>
        <Text dim bold padding="0.5em 0" margin={theme.spacing.bottom("1em")}>
          {`${route} to see photos and videos from your friends.`}
        </Text>

        {loading ? (
          <Spinner />
        ) : (
          <Form noValidate onSubmit={handleSubmit(onSubmit)}>
            {route === "Sign Up" ? (
              <>
                <Flex direction="column" align="flex-start">
                  <PlaceHolder>Full Name</PlaceHolder>
                  <TextInput
                    onFocus={onFocus}
                    type="text"
                    aria-label="Full Name"
                    autoCapitalize="sentences"
                    aria-required="true"
                    autoCorrect="on"
                    autoComplete="name"
                    spellCheck="true"
                    {...register("name", { onBlur, onChange })}
                  />
                  {errors.name?.message && (
                    <Error padding="0.5em 0">{errors.name.message}</Error>
                  )}
                </Flex>

                <Flex direction="column" align="flex-start">
                  <PlaceHolder>Email</PlaceHolder>
                  <TextInput
                    onFocus={onFocus}
                    aria-label="Email address"
                    autoCapitalize="off"
                    aria-required="true"
                    autoCorrect="off"
                    autoComplete="email"
                    type="email"
                    {...register("email", { onBlur, onChange })}
                  />
                  {errors.email?.message && (
                    <Error padding="0.5em 0">{errors.email.message}</Error>
                  )}
                </Flex>
              </>
            ) : (
              <>
                {AuthButton("Google")}
                {AuthButton("Facebook")}
                <Flex align="center">
                  <DashedBorder />
                  <Text padding="0 1em">OR</Text>
                  <DashedBorder />
                </Flex>
              </>
            )}

            <Flex direction="column" align="flex-start">
              <PlaceHolder>
                {route === "Sign Up" ? "Username" : "Username or Email"}
              </PlaceHolder>
              <TextInput
                onFocus={onFocus}
                aria-label="Username"
                autoCapitalize="off"
                aria-required="true"
                autoCorrect="off"
                // maxLength={3}
                type="text"
                {...register(
                  route === "Sign Up" ? "username" : "usernameOrEmail",
                  { onBlur, onChange }
                )}
              />
              {/* For Register */}
              {errors.username?.message && (
                <Error padding="0.5em 0">{errors.username.message}</Error>
              )}
              {/* For Login */}
              {errors.usernameOrEmail?.message && (
                <Error padding="0.5em 0">
                  {errors.usernameOrEmail.message}
                </Error>
              )}
            </Flex>

            <Flex direction="column">
              <Flex direction="column" align="flex-start">
                <PlaceHolder>Password</PlaceHolder>
                <TextInput
                  onFocus={onFocus}
                  aria-label="Password"
                  aria-required="true"
                  autoCapitalize="off"
                  autoComplete="new-password"
                  autoCorrect="off"
                  type="password"
                  {...register("password", {
                    onBlur,
                    onChange,
                  })}
                />
                <Status
                  // 👇 show password handler
                  onClick={({ currentTarget }) => {
                    const show = currentTarget.textContent === "Show";
                    currentTarget.textContent = show ? "Hide" : "Show";
                    currentTarget.previousElementSibling?.setAttribute(
                      "type",
                      show ? "text" : "password"
                    );
                  }}
                >
                  Show
                </Status>
              </Flex>
              {errors.password?.message && (
                <Error padding="0.5em 0">{errors.password.message}</Error>
              )}
            </Flex>

            {route === "Sign Up" && (
              <>
                <Flex direction="column" align="flex-start" index={1}>
                  <PlaceHolder sub>Gender</PlaceHolder>
                  <TextInput
                    sub
                    capitalize
                    onClick={() => toggleGenderSelector()}
                    type="text"
                    readOnly
                    {...register("gender", {})}
                  />
                  <Status onClick={() => toggleGenderSelector()}>⇩</Status>
                  <Flex
                    ref={genderContainer}
                    border
                    overflow="hidden"
                    direction="column"
                    position="absolute"
                    top="calc(100% + 0.5em)"
                    width="calc(100% - 2em)" // "30%"
                    left="1em" // "calc(50% - 30% / 2)"
                    filter={theme.blur.min}
                  >
                    {genders.map((gender, index) => (
                      <ToolTip
                        key={index}
                        onBlur={() => toggleGenderSelector()}
                        // 👇 gender selector handler
                        onClick={() => {
                          setValue("gender", gender);

                          const selector = genderContainer.current;

                          updateStyle(
                            selector?.childNodes[genderSelected.value],
                            { backgroundColor: "" }
                          );
                          updateStyle(selector?.childNodes[index], {
                            backgroundColor: "var(--hoverColor)",
                          });

                          genderSelected.update(index);

                          toggleGenderSelector();
                        }}
                      >
                        <Text transform="capitalize" padding="0.5em 0">
                          {gender}
                        </Text>
                      </ToolTip>
                    ))}
                  </Flex>
                </Flex>

                {/* Bio */}
                <Flex direction="column" align="flex-start">
                  <PlaceHolder>Bio</PlaceHolder>
                  <BioInput
                    rows={3}
                    maxLength={maxLength}
                    onFocus={onFocus}
                    {...register("bio", { onBlur, onChange })}
                  />

                  {errors.bio?.message && (
                    <Error padding="0.5em 0">{errors.bio.message}</Error>
                  )}
                </Flex>
              </>
            )}
            <Flex
              border
              overflow="hidden"
              align="center"
              justify="center"
              padding={authenticating ? "1em 0" : undefined}
            >
              {authenticating ? (
                <Spinner />
              ) : (
                <Submit type="submit" value={route} />
              )}
            </Flex>

            {route === "Login" && LOGIN.error && <Error>{LOGIN.error}</Error>}
            {route === "Sign Up" && REGISTER.error && (
              <Error>{REGISTER.error}</Error>
            )}
            {OAuthError && <Error>{OAuthError}</Error>}
          </Form>
        )}
      </Flex>
      <Flex border align="center" justify="center" padding="1em" margin="1em 0">
        <Text dim padding="0 0.25em">
          {route === "Sign Up" ? "Have an account?" : "Don't have an account?"}
        </Text>

        <Anchor
          onClick={() => setLoading(true)}
          to={route === "Sign Up" ? "/login" : "/register"}
        >
          <Text dim bold>
            {route === "Sign Up" ? "Login" : "Sign Up"}
          </Text>
        </Anchor>
      </Flex>
    </Container>
  );
};

export default Authenticate;
