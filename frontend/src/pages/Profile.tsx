// 👇 React
import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  useLayoutEffect,
} from "react";
// 👇 Styled Component
import styled, { useTheme } from "styled-components";
// 👇 React Router
import { Params, useParams } from "react-router-dom";
// 👇 Intersection Observer
import { useInView } from "react-intersection-observer";
// 👇 Styles
import { Error, Text } from "../styles/Text";
import { Flex, ToolTip } from "../styles/Containers";
// 👇 Components
import Post from "../components/Post";
import User from "../components/User";
import { Spinner } from "../components/Loader";
import FollowButton from "../components/FollowButton";
import Switch from "../components/Switch";
import LoadingImage from "../components/LoadingImage";
// 👇 Images
import backgroundProfile from "../images/Night-Jeep.jpg";
// 👇 Context
import { useStore } from "../providers/context";
// 👇 Custom hooks
import { useResize } from "../hooks/useResize";
import { usePagination } from "../hooks/usePagination";
import { useReference } from "../hooks/useReference";
import { USE_MUTATION, USE_QUERY } from "../hooks/useApollo";
// 👇 Services
import { AxiosError } from "axios";
import axios from "../services/axios";
// 👇 Icons
import {
  Camera2Icon,
  PencilSquareIcon,
  Check2CircleIcon,
} from "../components/Icons";
// 👇 Constants, Helpers & Types
import { ProfileState } from "../utils/types/enum";
import { Follow, GqlQueries, PostType } from "../utils/types";
import { KeyValue, UserType } from "../utils/types";
import {
  authProvider,
  avatarUrl,
  testObserver,
  updateProperty,
  updateStyle,
} from "../utils/helpers";
import { SEO } from "../utils/constants";

const height = "8em";

const Background = styled.div`
  --height: 100%;
  --opacity: 1;
  --position: 50%;
  position: absolute;
  width: 100%;
  height: var(--height);
  background-color: rgb(42 55 81 / 90%);
  transition: all 0.5s;
  &:after {
    content: "";
    position: absolute;
    width: 100%;
    height: 100%;
    transition: inherit;
    box-shadow: 3px 3px 4px 0px rgb(0 0 0 / 50%);
    background-image: url(${backgroundProfile});
    background-position: 0 var(--position);
    background-repeat: no-repeat;
    background-size: 100% 200%;
    opacity: var(--opacity);
  }
`;

const Container = styled.div`
  width: 100%;
  height: calc(${height} + 16px);
  z-index: 1;
  position: sticky;
  top: 0;
`;

const HeaderContainer = styled(Flex)`
  --dimension: ${height};
  z-index: 1;
  top: 3px;
  align-items: flex-start;
  position: sticky;
  margin-top: calc(var(--dimension) / -2);
  padding: 0 1em;
`;

const Header = styled(Flex)<{
  alignSelf: "center" | "end";
}>`
  transition: all 0.5s;
  margin-left: 1em;
  align-self: ${({ alignSelf }) => alignSelf};
  flex-direction: column;
  overflow: hidden;
  /* mobile */
  @media (max-width: 575px) {
    margin-left: 0.5em;
  }
`;

const Bio = styled(Text)`
  transition: all 0.5s;
  opacity: 1;
  line-height: 1.3;
  display: block;
  margin-right: 0.5em;
  height: auto;
  padding: 0;
  &:read-write:focus {
    outline: none;
  }
`;

const UserInfo = styled.div`
  position: relative;
  span:not(:last-child) {
    margin-right: 2em;
  }

  /* mobile */
  @media (max-width: 575px) {
    span:not(:last-child) {
      margin-right: 1em;
    }
  }
`;

const Selector = styled.div`
  --left: 0;
  --width: 0.2em;
  left: var(--left);
  width: var(--width);
  transition: all 0.5s;
  position: relative;
  margin-top: 0.25em;
  height: 0;
  border: none;
  border-top: 0.2em solid white;
`;

const UserSelect = styled(Text)`
  display: inline-block;
  padding: 0.25em 0;
`;

const Profile = () => {
  const theme = useTheme();
  const params = useParams();
  const { user, authenticating } = useStore();
  const { ref, inView } = useInView({
    initialInView: true,
  });
  const { paginate, finished, reset, Progress } = usePagination(ref, inView);
  const [uploadError, setUploadError] = useState("");
  const [selection, setSelection] = useState<GqlQueries>("getUserPosts");
  const [editBio, setEditBio] = useState<"EDIT" | "SAVE" | "NONE">("NONE");
  const header = useRef<HTMLDivElement | null>(null);
  const bio = useRef<HTMLSpanElement | null>(null);
  const selector = useRef<HTMLDivElement | null>(null);
  const selectorOptions = useRef<HTMLDivElement | null>(null);
  const background = useRef<HTMLImageElement | null>(null);
  const selectedFile = useRef<File | null>(null);
  // 👇 for monitoring url parameters change
  const storeParams = useReference<Params<string>>({});
  const prevSelector = useReference(0);
  const prevSelection = useReference<GqlQueries | null>(null);

  // 👇 update bio mutation
  const UPDATE_BIO = USE_MUTATION<boolean>("updateBio");

  // 👇 user related data queries
  const GET_USER = USE_QUERY<UserType>(false, "getUser");
  const GET_USER_POSTS = USE_QUERY<PostType[]>(true, "getUserPosts");
  const GET_USER_COMMENTS = USE_QUERY<PostType[]>(true, "getUserComments");
  const GET_USER_MEDIAS = USE_QUERY<PostType[]>(true, "getUserMedias");
  const GET_USER_LIKES = USE_QUERY<PostType[]>(true, "getUserLikes");
  const GET_USER_FOLLOWERS = USE_QUERY<UserType[]>(true, "getFollowers");
  const GET_USER_FOLLOWING = USE_QUERY<UserType[]>(true, "getFollowing");
  const FOLLOW_COUNT = USE_QUERY<Follow>(false, "getFollowCount");
  const FOLLOW_STATUS = USE_QUERY<Follow>(false, "getFollowStatus");

  // 👇 query variables
  const variables = useMemo(
    () => ({
      authInput: {
        auth: authProvider(params.auth),
        username: params.username,
      },
      // offset: 0,
      // limit: 1,
    }),
    [params]
  );
  const variablesParams = useMemo(
    () => `${params.auth}${params.username}`,
    [params]
  );

  const canUpdateProfile = useMemo(
    () =>
      user?.auth === variables.authInput.auth &&
      user?.username === variables.authInput.username,
    [user, variablesParams]
  );

  // 👇 query selection elements
  const userSelection = useMemo(
    () => (
      <div>
        <UserInfo ref={selectorOptions}>
          <UserSelect hover dim data-query="getUserPosts">
            Posts
          </UserSelect>
          <UserSelect hover dim data-query="getUserComments">
            Replies
          </UserSelect>
          <UserSelect hover dim data-query="getUserMedias">
            Media
          </UserSelect>
          <UserSelect hover dim data-query="getUserLikes">
            Likes
          </UserSelect>
        </UserInfo>
        <Selector ref={selector} />
      </div>
    ),
    []
  );

  // 👇 selected posts render
  const userPosts = useMemo(
    () => (
      <Flex direction="column" padding="0 1em">
        {selection === "getUserPosts"
          ? GET_USER_POSTS.data?.map((value) => (
              <Post
                key={value.id + value.stats?.comments + value.stats?.likes}
                post={value}
              />
            ))
          : selection === "getUserComments"
          ? GET_USER_COMMENTS.data?.map((value) => (
              <Post
                key={value.id + value.stats?.comments + value.stats?.likes}
                post={value}
              />
            ))
          : selection === "getUserMedias"
          ? GET_USER_MEDIAS.data?.map((value) => (
              <Post
                key={value.id + value.stats?.comments + value.stats?.likes}
                post={value}
              />
            ))
          : selection === "getUserLikes"
          ? GET_USER_LIKES.data?.map((value) => (
              <Post
                key={value.id + value.stats?.comments + value.stats?.likes}
                post={value}
              />
            ))
          : selection === "getFollowers"
          ? GET_USER_FOLLOWERS.data?.map((value) => (
              <User
                followButton={canUpdateProfile}
                key={value.id}
                user={value}
                selection={value.mutual ? "Following" : "Follow"}
              />
            ))
          : selection === "getFollowing" &&
            GET_USER_FOLLOWING.data?.map((value) => (
              <User
                followButton={canUpdateProfile}
                key={value.id}
                user={value}
                selection="Following"
              />
            ))}
      </Flex>
    ),

    [
      selection,
      canUpdateProfile,
      GET_USER_POSTS.loading,
      GET_USER_COMMENTS.loading,
      GET_USER_MEDIAS.loading,
      GET_USER_LIKES.loading,
      GET_USER_FOLLOWING.loading,
      GET_USER_FOLLOWERS.loading,
    ]
  );

  // 👇 pagination method based on user option selection
  const fetchUserPosts = useCallback(() => {
    switch (selection) {
      case "getUserPosts":
        paginate(GET_USER_POSTS, variables);
        break;

      case "getUserComments":
        paginate(GET_USER_COMMENTS, variables);
        break;

      case "getUserMedias":
        paginate(GET_USER_MEDIAS, variables);
        break;

      case "getUserLikes":
        paginate(GET_USER_LIKES, variables);
        break;

      case "getFollowers":
        paginate(GET_USER_FOLLOWERS, variables);
        break;

      case "getFollowing":
        paginate(GET_USER_FOLLOWING, variables);
        break;

      default:
        break;
    }
  }, [
    paginate,
    variablesParams,
    GET_USER_POSTS.loading,
    GET_USER_COMMENTS.loading,
    GET_USER_MEDIAS.loading,
    GET_USER_LIKES.loading,
    GET_USER_FOLLOWING.loading,
    GET_USER_FOLLOWERS.loading,
  ]);

  // 👇 selection animator
  const selectionMover = useCallback((curr = 0) => {
    const select = selector.current;
    const option = selectorOptions.current;
    if (!select || !option) {
      return;
    }

    const prev = prevSelector.value;
    prevSelector.update(curr);

    const children = option.children as unknown as HTMLSpanElement[];
    const query = children[curr].getAttribute("data-query") as GqlQueries;

    // 👇 update selection
    setSelection(query);

    updateStyle(children[prev], {
      color: "",
    });
    updateStyle(children[curr], {
      color: "white",
    });

    // 👇 transition selector positioning and width to current selection
    if (curr === prev) {
      updateProperty(select, {
        "--state": ProfileState.SCALE,
        "--left": `calc(${children[prev].offsetLeft}px + ${children[prev].clientWidth}px / 2)`,
        "--width": "0.2em",
      });
    } else {
      const min = Math.min(prev, curr);
      const max = Math.max(prev, curr);
      const left = `calc(${children[min].offsetLeft}px + ${children[min].clientWidth}px / 2)`;
      const width =
        children[max].offsetLeft -
        children[min].offsetLeft -
        children[min].clientWidth / 2 +
        children[max].clientWidth / 2 +
        "px";

      /* 
        let wTotal = 0;
        for (let i = min + 1; i < max; i++) {
          wTotal += children[i].clientWidth;
        }
        const width = `calc(${children[prev].clientWidth}px / 2 + ${2 * (max - min)}em + ${wTotal}px + ${
          children[max].clientWidth
          }px / 2)`
      */
      updateProperty(select, {
        "--state": ProfileState.EXPAND,
        "--left": left,
        "--width": width,
      });
    }
  }, []);

  // 👇 on window resize update selector animation
  useResize((ev) => {
    const resize = Boolean(ev);
    if (resize) {
      updateProperty(selector.current, {
        "--state": ProfileState.EXPAND,
      });
    } else {
      selectionMover(prevSelector.value);
    }
  });

  // 👇 page title
  useLayoutEffect(() => {
    const getUser = GET_USER.data;
    if (getUser) {
      document.title = `${getUser.name} (${getUser.username}) / ${SEO.title}`;
    }
  }, [GET_USER.data]);

  // 👇 scrolling events handling
  useLayoutEffect(() => {
    const addScrollListener = (ev?: TransitionEvent) => {
      if (!ev || ev.propertyName === "opacity") {
        window.addEventListener("scroll", handleScroll, { passive: true });
      }
    };

    const removeScrollListener = (ev?: TransitionEvent) => {
      if (!ev || ev.propertyName === "opacity") {
        window.removeEventListener("scroll", handleScroll);
      }
    };

    // 👇 hide bio based on scroll position
    const bioScroll = (ratio: number) => {
      const bioElement = bio.current;
      if (!bioElement) {
        return;
      }

      bioElement.removeEventListener("transitionend", addScrollListener);
      bioElement.addEventListener("transitionend", addScrollListener);

      const bioContainer = bioElement.parentElement as HTMLDivElement;
      const edit = header.current?.querySelector<HTMLDivElement>(".edit");
      const opacity = bioElement.style.opacity;

      // 👇 scrolled top
      if (ratio < 0.5 && opacity === "0") {
        removeScrollListener();
        updateStyle(bioContainer, {
          padding: "",
        });
        updateStyle(bioElement, {
          lineHeight: "",
          opacity: "",
        });
        updateStyle(edit, {
          display: "",
        });
      }
      // 👇 scrolled bottom
      else if (ratio >= 0.5 && opacity === "") {
        removeScrollListener();
        updateStyle(bioContainer, {
          padding: "0",
        });
        updateStyle(bioElement, {
          lineHeight: "0",
          opacity: "0",
        });
        updateStyle(edit, {
          display: "none",
        });
      }
    };

    // 👇 scroll handler and header background animation handler
    const handleScroll = () => {
      const backgroundElement = background.current;
      if (!header.current || !backgroundElement) {
        return;
      }

      const { clientHeight } = header.current;
      const height = Math.min(clientHeight, window.scrollY);
      const ratio = height / clientHeight;

      updateProperty(backgroundElement, {
        "--height": (1 - ratio) * 10 + 100 + "%",
        "--opacity": (1 - ratio + 0.7).toString(),
        "--position": 15 * ratio + 50 + "%",
      });

      bioScroll(ratio);
    };

    // 👇 add user selector animation to all selector options
    selectorOptions.current?.childNodes.forEach((child, index) => {
      child.addEventListener("click", () => selectionMover(index));
    });

    // 👇 selector animation for width reset after expanding
    selector.current?.addEventListener(
      "transitionend",
      (ev: TransitionEvent) => {
        const target = ev.target as typeof selector.current;
        const state = target.style.getPropertyValue(
          "--state"
        ) as keyof typeof ProfileState;

        if (ProfileState[state] === ProfileState.EXPAND) {
          selectionMover(prevSelector.value);
        }
      }
    );

    handleScroll();

    addScrollListener();

    // 👇 remove event listener on unmount
    return () => removeScrollListener();
  }, []);

  // 👇 follow stats
  useLayoutEffect(() => {
    if (user && !canUpdateProfile) {
      testObserver("FOLLOW_STATUS");
      FOLLOW_STATUS.fetch({
        variables,
      });
    }
  }, [user, canUpdateProfile]);

  // 👇 url parameters change handling
  useLayoutEffect(() => {
    const option = {
      variables,
    };

    testObserver("GET_USER");
    GET_USER.fetch(option);

    testObserver("FOLLOW_COUNT");
    FOLLOW_COUNT.fetch(option);

    // 👇 scroll to top on url parameters change
    window.scrollTo({
      top: 0,
      behavior: "auto",
    });

    setEditBio("NONE");

    // 👇 reset various styles to initial values
    const headerElement = header.current;
    const loader = headerElement?.querySelector(".loader") as HTMLDivElement;
    const percent = headerElement?.querySelector(".percent") as HTMLSpanElement;
    const update = headerElement?.querySelector(
      ".update"
    ) as HTMLDivElement | null;

    updateStyle(loader, {
      display: "flex",
    });
    updateStyle(update, {
      display: "flex",
    });
    percent.textContent = "";

    // 👇 if selector is on the default selection
    if (selection === "getUserPosts") {
      // 👇 reset query and fetch
      prevSelection.update(selection);
      reset();
      fetchUserPosts();
    } else {
      // 👇 manually click the default selection
      (selectorOptions.current?.children.item(0) as HTMLElement).click();
    }
  }, [variablesParams]);

  // 👇 pagination handling
  useLayoutEffect(() => {
    const { auth, username } = storeParams.value;
    // 👇 has url parameters change
    if (auth !== params.auth || username !== params.username) {
      // 👇 update the new url parameters
      storeParams.update(params);
      return;
    }

    const refetch = prevSelection.value !== selection;
    prevSelection.update(selection);

    if (!refetch) {
      if (finished || !inView) {
        return;
      }
    } else {
      reset();
    }

    fetchUserPosts();
  }, [
    inView,
    selection,
    GET_USER_POSTS.loading,
    GET_USER_COMMENTS.loading,
    GET_USER_MEDIAS.loading,
    GET_USER_LIKES.loading,
    GET_USER_FOLLOWING.loading,
    GET_USER_FOLLOWERS.loading,
  ]);

  // 👇 update biography handling
  useEffect(() => {
    const bioElement = bio.current;
    if (!bioElement || editBio === "NONE") {
      return;
    }
    if (editBio === "EDIT") {
      bioElement.setAttribute("contenteditable", "true");
      bioElement.classList.add("bio-edit");
      bioElement.focus();
    }
    if (editBio === "SAVE") {
      testObserver("UPDATE_BIO");
      UPDATE_BIO.mutate({
        variables: {
          bio: bioElement.innerText,
        },
      }).finally(() => {
        bioElement.setAttribute("contenteditable", "false");
        bioElement.classList.remove("bio-edit");

        setEditBio("NONE");
      });
    }
  }, [editBio]);

  // 👇 user option selection change handling
  useEffect(() => {
    // 👇 scroll to top smoothly
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });

    const select = selector.current;
    const option = selectorOptions.current;
    if (!select || !option) {
      return;
    }
    if (selection === "getFollowers" || selection === "getFollowing") {
      const children = selectorOptions.current
        ?.childNodes as NodeListOf<HTMLSpanElement>;

      updateStyle(children[prevSelector.value], {
        color: "",
      });
      updateStyle(select, {
        borderColor: theme.color.textColor,
      });

      // 👇 refetch follow count
      if (!FOLLOW_COUNT.loading) {
        testObserver("FOLLOW_COUNT");
        FOLLOW_COUNT.refetch();
      }
    } else {
      updateStyle(select, {
        borderColor: "",
      });
    }
  }, [selection]);

  return (
    <>
      <Container>
        <Background data-testid="profile-background" ref={background} />
      </Container>
      <HeaderContainer data-testid="profile-header" ref={header}>
        <LoadingImage
          src={avatarUrl(params.username, variables.authInput.auth)}
          size="var(--dimension)"
          percent={true}
          prop={{
            border: {
              radius: "50%",
              width: "5px",
            },
          }}
          onLoad={() => {
            // 👇 show update profile icon after profile image loads
            const update = header.current?.querySelector(
              ".update"
            ) as HTMLDivElement | null;
            updateStyle(update, {
              display: "flex",
            });
          }}
          element={
            <>
              {canUpdateProfile && (
                <form
                  method="post"
                  encType="multipart/form-data"
                  onSubmit={(event) => {
                    // 👇 prevent the form from submitting
                    event.preventDefault();

                    const loader = header.current?.querySelector(
                      ".loader"
                    ) as HTMLDivElement;
                    const percent = header.current?.querySelector(
                      ".percent"
                    ) as HTMLSpanElement;
                    const update = header.current?.querySelector(
                      ".update"
                    ) as HTMLDivElement;

                    // 👇 reset upload progress and related styles
                    percent.textContent = "0 %";
                    updateStyle(loader, {
                      display: "flex",
                    });
                    updateStyle(update, {
                      display: "none",
                    });

                    // 👇 clear upload error
                    setUploadError("");

                    const formData = new FormData();
                    formData.append("image", selectedFile.current!);

                    axios
                      .post("/image/avatar", formData, {
                        headers: {
                          "Content-Type": "multipart/form-data",
                        },
                        // 👇 upload progress callback
                        onUploadProgress: ({
                          loaded,
                          total,
                        }: KeyValue<number>) => {
                          percent.textContent =
                            Math.round((100 * loaded) / total) + " %";
                        },
                      })
                      .then(({ data }) => {
                        const image = header.current?.querySelector(
                          ".image"
                        ) as HTMLImageElement;

                        testObserver("UPDATE_AVATAR");
                        // 👇 show newly updated profile after successful upload
                        image.src = avatarUrl(
                          variables.authInput.username,
                          variables.authInput.auth
                        );
                        //  closeMedia();
                      })
                      .catch(({ response }: AxiosError) => {
                        if (!response) {
                          return;
                        }
                        const {
                          data: { code, message },
                        } = response;

                        // console.log({ code, message });

                        // 👇 set upload error caught
                        setUploadError(message);
                      });
                  }}
                >
                  <input
                    className="upload"
                    type="file"
                    hidden
                    accept="image/*"
                    onClick={({ currentTarget }) => {
                      // 👇
                      // clear previous selected file on each onclick event
                      // so as to trigger the onchange event even if the same path is selected
                      currentTarget.value = "";
                    }}
                    onChange={({ currentTarget }) => {
                      setUploadError("");
                      // 👇 select only the first file user chose
                      const file = currentTarget.files?.item(0);
                      if (file) {
                        selectedFile.current = file;
                        const submit = header.current?.querySelector(
                          ".submit"
                        ) as HTMLInputElement;
                        // 👇 manually trigger form submit event
                        submit.click();
                      }
                    }}
                  />

                  {/* 👇 hidden submit button */}
                  <input className="submit" type="submit" hidden />

                  <ToolTip
                    className="update"
                    index={1}
                    position="absolute"
                    align="flex-start"
                    padding="3px"
                    top={`calc(var(--dimension) - ${theme.sizing.icon} - 3px)`}
                    right={`calc(${theme.sizing.icon} / 4)`}
                    tip="Upload"
                    border
                    background="blurMin"
                    tipPosition="bottom"
                    scale={1.05}
                    onClick={() => {
                      const upload = header.current?.querySelector(
                        ".upload"
                      ) as HTMLInputElement;
                      // 👇 manually call file selector
                      upload.click();
                    }}
                  >
                    <Camera2Icon />
                  </ToolTip>
                </form>
              )}
            </>
          }
        />

        <Header alignSelf={uploadError ? "center" : "end"}>
          <Flex align="center">
            <Text
              dim
              padding="0.25em 0"
              ellipsis={1}
              margin={theme.spacing.right("1em")}
            >
              @{params.username}
            </Text>

            {user &&
              !canUpdateProfile &&
              (authenticating || FOLLOW_STATUS.loading ? (
                <Spinner />
              ) : (
                FOLLOW_STATUS.data && (
                  <Flex align="center" width="unset">
                    <FollowButton
                      initial={
                        // 👇 check if we are already following
                        FOLLOW_STATUS.data.following ? "Following" : "Follow"
                      }
                      user={{
                        auth: variables.authInput.auth,
                        username: params.username,
                      }}
                      callback={() => {
                        testObserver("FOLLOW_STATUS");
                        FOLLOW_STATUS.refetch();
                      }}
                      properties={{
                        container: {
                          width: "fit-content",
                        },
                        text: {
                          dim: false,
                        },
                      }}
                    />
                    {FOLLOW_STATUS.data.followers ? (
                      <ToolTip
                        cursor="default"
                        padding="0.25em"
                        filter={theme.blur.min}
                        margin={theme.spacing.left("1em")}
                        border={{
                          radius: "0",
                          width: "0.25em",
                        }}
                      >
                        <Text
                          data-testid={`mutual-${variables.authInput.auth}-${variables.authInput.username}`}
                          preserve
                          // paragraph
                          font="smaller"
                        >
                          {FOLLOW_STATUS.data.following
                            ? "👥 Mutual"
                            : "Follows you"}
                        </Text>
                      </ToolTip>
                    ) : null}
                  </Flex>
                )
              ))}
          </Flex>
          {authenticating || FOLLOW_STATUS.loading || GET_USER.loading ? (
            <Spinner />
          ) : (
            <>
              <Text bold font="x-large" ellipsis={1}>
                {GET_USER.data?.name || "-"}
              </Text>

              <Flex padding={"0.5em 0"} align="flex-start">
                <Bio
                  data-testid="bio-input"
                  ref={bio}
                  ellipsis={2}
                  onInput={() =>
                    // 👇 always scroll to top when updating bio
                    window.scrollTo({
                      top: 0,
                      behavior: "auto",
                    })
                  }
                >
                  {GET_USER.data?.bio || "-"}
                </Bio>

                {canUpdateProfile && (
                  <>
                    {UPDATE_BIO.loading ? (
                      <Spinner />
                    ) : (
                      <ToolTip
                        hover={false}
                        data-testid="bio-edit"
                        className="bio-change"
                        tip={editBio === "EDIT" ? "Save" : "Edit"}
                        tipPosition="top"
                        margin={theme.spacing.right("0.5em")}
                        padding={theme.spacing.top("0.125em")}
                        scale={1.05}
                        onClick={() => {
                          if (editBio === "NONE") {
                            setEditBio("EDIT");
                          } else if (editBio === "EDIT") {
                            setEditBio("SAVE");
                          }
                        }}
                      >
                        {editBio === "EDIT" ? (
                          <Check2CircleIcon data-testid="bio-save" />
                        ) : (
                          <PencilSquareIcon data-testid="bio-update" />
                        )}
                      </ToolTip>
                    )}
                  </>
                )}
              </Flex>

              {UPDATE_BIO.error && <Error>{UPDATE_BIO.error}</Error>}
            </>
          )}

          <Flex margin="0.25em 0">
            <ToolTip
              data-testid="following"
              hover={false}
              onClick={() => {
                setSelection("getFollowing");
              }}
            >
              {FOLLOW_COUNT.loading ? (
                <Spinner />
              ) : (
                <Text>
                  {FOLLOW_COUNT.error ? "-" : FOLLOW_COUNT.data?.following}
                </Text>
              )}

              <Text
                data-testid="following-text"
                dim={selection !== "getFollowing"}
                margin={theme.spacing.right("1em")}
              >
                &nbsp;Following&nbsp;{selection === "getFollowing" && "•"}
              </Text>
            </ToolTip>
            <ToolTip
              data-testid="followers"
              hover={false}
              onClick={() => setSelection("getFollowers")}
            >
              {FOLLOW_COUNT.loading ? (
                <Spinner />
              ) : (
                <Text>
                  {FOLLOW_COUNT.error ? "-" : FOLLOW_COUNT.data?.followers}
                </Text>
              )}
              <Text
                data-testid="followers-text"
                dim={selection !== "getFollowers"}
                margin={theme.spacing.right("1em")}
              >
                &nbsp;Followers&nbsp;{selection === "getFollowers" && "•"}
              </Text>
            </ToolTip>
          </Flex>

          <Flex justify="space-between" align="center">
            {userSelection}
            {/* 👇 notification toggle display  */}
            {canUpdateProfile && <Switch />}
          </Flex>
        </Header>
      </HeaderContainer>
      {uploadError && <Error padding="0 1em">{uploadError}</Error>}

      {/* 👇 selected posts render */}
      {userPosts}

      {/* 👇 pagination status */}
      <Progress />
    </>
  );
};

export default Profile;
