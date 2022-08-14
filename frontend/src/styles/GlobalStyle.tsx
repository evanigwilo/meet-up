// 👇 Styled Component
import { createGlobalStyle, css } from "styled-components";
// 👇 Styles
import { BackgroundCSS } from "./Background";

const scrollbarStyle = css`
  body {
    ::-webkit-scrollbar-track {
      border-radius: unset;
    }
  }
  ::-webkit-scrollbar {
    width: 1em;
  }
  /* Track */
  ::-webkit-scrollbar-track {
    background: ${({ theme }) => theme.color.scrollTrack};
    box-shadow: ${({ theme }) =>
      `inset 0 0 1px 1px ${theme.color.transparentLight}`};
    border-radius: 10px;
    /* cursor:pointer; */
  }
  /* Handle */
  ::-webkit-scrollbar-thumb {
    /* transition: background 0.5s; */
    background: ${({ theme }) => theme.color.scrollThumb};
    border-radius: 10px;
  }
  /* Handle on hover */
  ::-webkit-scrollbar-thumb:hover {
    background: rgb(164 175 191 / 1);
  }
`;

const videoStyle = css`
  .stream::-webkit-media-controls {
    /* display: none; */
  }
  /* Could Use this as well for Individual Controls */
  .stream::-webkit-media-controls-mute-button {
    /* display: none; */
  }
  .stream::-webkit-media-controls-volume-slider {
    /* display: none; */
  }
  .stream::-webkit-media-controls-fullscreen-button {
    display: none;
  }
  .stream::-webkit-media-controls-play-button {
    display: none;
  }
  .stream::-webkit-media-controls-timeline {
    display: none;
  }
  .stream::-webkit-media-controls-current-time-display {
    display: none;
  }
  .stream::-webkit-media-controls-time-remaining-display {
    display: none;
  }
  .stream::-webkit-media-controls-toggle-closed-captions-button {
    display: none;
  }
`;

const fontSizes = css`
  /* 
    X-Small devices (portrait phones, less than 576px)
    No media query for 'xs' since this is the default in Bootstrap
  */
  @media screen and (max-width: 575px) {
    body {
      font-size: 0.8em !important;
    }
  }
  /* 
    Small devices (landscape phones, 576px and up)
  */
  @media screen and (min-width: 576px) and (max-width: 767px) {
    body {
      font-size: 0.9em !important;
    }
  }
  /* 
    Medium devices (tablets, 768px and up)
  */
  @media screen and (min-width: 768px) and (max-width: 991px) {
    body {
      font-size: 1em !important;
    }
  }
  /* 
    Large devices (desktops, 992px and up)
  */
  @media screen and (min-width: 992px) and (max-width: 1200px) {
    body {
      font-size: 1.1em !important;
    }
  }
  /* 
    X-Large devices (large desktops, 1200px and up)
  */
  @media screen and (min-width: 1201px) and (max-width: 1400px) {
    body {
      font-size: 1.2em !important;
    }
  }
  /* 
    XX-Large devices (larger desktops, 1400px and up)
  */
  @media screen and (min-width: 1401px) {
    body {
      font-size: 1.3em !important;
    }
  }
`;

export default createGlobalStyle`
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  :root {
  }

  html { 
    /* height: 100%;   
    overflow: auto; */
  }

  body {
    /* position: absolute;
    width: 100%;
    height: inherit; */ 
    overflow-x: hidden;
    font-family: 'Oxygen', sans-serif;
    max-width: 1000px;
    margin: auto;
    background-color: ${({ theme }) => theme.color.scrollTrack};
    // 👇 set variables for 'BackgroundCSS' below
    --position: fixed;
    --attachment: fixed;
    ${BackgroundCSS}
  }

  /* stop magnifying glass from being rendered */
  input[type=search] {
    -webkit-appearance: textfield;
  }
  /* to also hide the "Clear" button */
  ::-webkit-search-cancel-button { display: none; }

  input, textarea {
    font-size: inherit;
    font-family: inherit;
  }

  /* [contenteditable] {
    outline: 0px solid transparent;
  } */
  
  .bio-edit {
    display: inline;
    text-decoration: underline;
    text-decoration-style: dotted;
    text-decoration-thickness: 0.125em;
  }

  .handle{
    /* 
      font-weight:bold;
    */
    color: lightskyblue;
    text-shadow: 0px 1px 1px rgb(0 0 0 / 35%);
  }
  /* 
    Small devices (landscape phones, 576px and up)
  */
  @media screen and (min-width: 576px) {
    .handle {
      border-bottom-style: dotted;
      border-bottom-width: 0.125em;
    }
  }

  ${scrollbarStyle}

  ${videoStyle}

  ${fontSizes}
`;
