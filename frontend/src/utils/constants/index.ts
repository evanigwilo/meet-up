// 👇 Apollo & Graphql
import { gql } from "@apollo/client";

export const {
  REACT_APP_SERVER_API_VERSION,
  REACT_APP_SERVER_HOST,
  REACT_APP_SERVER_PATH,
  REACT_APP_SERVER_PORT,
  REACT_APP_SERVER_PROTOCOL,
} = process.env;

// 👇 search engine optimization properties
export const SEO = {
  title: "Meet-Up",
  logo: "❖",
};

export const serverName = "SERVER";

// 👇 gender selection options
export const genders = ["male", "female", "neutral"];

// 👇 random trends
export const trends = [
  "Covid",
  "Liverpool",
  "Benz",
  "South Africa",
  "JavaScript",
  "#HalaRonaldo",
  "Twilight",
  "Europe",
  "Oscar",
  "Google",
  "Kim Kardashian",
  "Elon Musk",
  "Gucci",
  "#SaudiArabia",
  "Blender",
];

export const gqlUserSub = `
  id
  name
  username
  auth
  active
  createdDate
`;

export const gqlUser = `
  ${gqlUserSub}
  email
  gender
  bio
  mutual
  token
  notification
  notifications {
    type
    total
  }
`;

export const gqlPost = `
  id
  body
  media
  createdDate
  createdBy {
    ${gqlUserSub}
  }
  stats {
    likes
    comments
    liked
  }
  parent {
    id
    stats {
      likes
      comments
      liked
    }
  }
  `;

export const gqlReaction = `
  id
  reaction
  user {
    ${gqlUserSub}
  }
  createdDate
  message {
    id
  }
`;

export const gqlMessageSub = `
  id
  body
  createdDate
  missed
  deleted
  media
`;

export const gqlMessage = `
  ${gqlMessageSub}
  type
  reactions {
    ${gqlReaction}
  }
  from {
    ${gqlUserSub}
  }
  to {
    id
  }
`;

export const gqlConversation = `
  id
  seen
  from {
    ${gqlUserSub}
  }
  to {
    ${gqlUserSub}
  }
  message {
    ${gqlMessageSub}
  }
`;

export const gqlConversations = `
  unseen
  update
  from
  to
`;

export const gqlReacted = `
  reaction
  deleted
  message
  from
  to
  user
`;

export const gqlNotification = `
  id
  identifier
  type
  seen
  viewed
  createdDate
  from {
    id
    name
  }
  to {
    id
  }
`;

export const gqlFollowCount = `
  followers
  following
`;

export const gqlQueries = {
  getUser: gqlUser,
  getPost: gqlPost,
  getPosts: gqlPost,
  getMessages: gqlMessage,
  getUserPosts: gqlPost,
  getUserComments: gqlPost,
  getUserMedias: gqlPost,
  getUserLikes: gqlPost,
  getFollowers: gqlUser,
  getFollowing: gqlUser,
  getConversations: gqlConversation,
  getNotifications: gqlNotification,
  getFollowCount: gqlFollowCount,
  getFollowStatus: gqlFollowCount,
  findUser: gqlUserSub,
  auth: gqlUser,
};

export const reactions = {
  like: "👍",
  love: "❤️",
  funny: "😂",
  wow: "😲",
  sad: "😔",
  angry: "😡",
};

export const gqlMutations = {
  likePost: gql`
    mutation likePost($id: ID!) {
      likePost(id: $id)
    }
  `,
  unLikePost: gql`
    mutation likePost($id: ID!) {
      unLikePost(id: $id)
    }
  `,
  login: gql`
    mutation login($usernameOrEmail: String!, $password: String!) {
      login(usernameOrEmail: $usernameOrEmail, password: $password) {
        ${gqlUserSub}
      }
    }
  `,
  logout: gql`
    mutation Logout {
      logout
    }
  `,
  register: gql`
    mutation register($userInput: UserInput!) {
      register(userInput: $userInput) {
        ${gqlUserSub}
      }
    }
  `,
  toggleNotification: gql`
    mutation toggleNotification($toggle: Boolean!) {
      toggleNotification(toggle: $toggle)
    }
  `,
  createPost: gql`
    mutation createPost($postInput: PostInput!) {
      createPost(postInput: $postInput) {
        ${gqlPost}
      }
    }
    `,
  sendMessage: gql`
    mutation sendMessage($messageInput: MessageInput!) {
        sendMessage(messageInput: $messageInput) {
        ${gqlMessage}
        }
      }
    `,
  followUser: gql`
    mutation followUser($authInput: AuthInput!) {
      followUser(authInput: $authInput)
    }
  `,
  unFollowUser: gql`
    mutation unFollowUser($authInput: AuthInput!) {
      unFollowUser(authInput: $authInput)
    }
  `,
  deleteMessage: gql`
    mutation deleteMessage($id: ID!) {
      deleteMessage(id: $id) {
        id
      }
    }
  `,
  addReactionMessage: gql`
    mutation addReactionMessage($id: ID!, $reaction: String!) {
      addReactionMessage(id: $id, reaction: $reaction) {
        ${gqlReaction}
      }
    }`,
  removeReactionMessage: gql`
    mutation removeReactionMessage($id: ID!) {
      removeReactionMessage(id: $id)
    }
  `,
  updateBio: gql`
    mutation updateBio($bio: String!) {
      updateBio(bio: $bio)
    }
  `,
};

export const gqlSubscriptions = {
  notification: gql`
    subscription notification {
      notification {
        ${gqlNotification}
      }
    }
    `,
  conversations: gql`
    subscription conversations {
      conversations {
        ${gqlConversations}
      }
    }
    `,
  reacted: gql`
    subscription reacted {
      reacted {
        ${gqlReacted}
      }
    }
    `,
  message: gql`
    subscription message {
      message {
        ${gqlMessage}
      }
    }
    `,
};
