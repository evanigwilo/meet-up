// 👇 Faker
import { faker } from "@faker-js/faker";
// 👇 Services
import axios from "../../services/axios";
// 👇 Constants, Helpers & Types
import { uniqueId } from "../../utils/helpers";

// export const realDate = Date;
// 👇 Sat Jan 01 2022 00:00:00 GMT+0000 (Greenwich Mean Time)
export const testDate = new Date("2022-01-01");
export const testTime = testDate.getTime().toString();
// export const msOneDay = 24 * 60 * 60 * 1000;

export const uploadId = uniqueId();

export const trueFalse = [true, false];

export const usersFound = 5;

// 👇 non-breakable space
export const nbsp = String.fromCharCode(160);

export const objectUrl = `blob:${axios.defaults.baseURL}/${faker.helpers.unique(
  faker.datatype.uuid
)}`;

export const userCalling = {
  id: uniqueId(),
  name: faker.helpers.unique(faker.name.fullName),
};

export const noDisplay = { display: "none" };
export const flexDisplay = { display: "flex" };

export const disabledElement = {
  "pointer-events": "none",
  opacity: "0",
};
export const enabledElement = {
  "pointer-events": "unset",
  opacity: "1",
};

export const testHandles = {
  find: "find",
  none: "none",
};

export const followCount = {
  followers: 10,
  following: 10,
};
