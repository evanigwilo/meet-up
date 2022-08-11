import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

// 👇 support for relative timing
dayjs.extend(relativeTime);

export default dayjs;
