import { execFileSync } from "node:child_process";

export const chatVideoFormats = [
  ["mp4", "video/mp4"], ["mov", "video/quicktime"], ["webm", "video/webm"],
  ["mkv", "video/matroska"], ["avi", "video/vnd.avi"], ["m4v", "video/x-m4v"],
];

export function createChatVideoFixture(path, extension) {
  const codec = extension === "webm" ? ["-c:v","libvpx-vp9","-deadline","realtime","-cpu-used","8"]
    : extension === "avi" ? ["-c:v","mpeg4","-q:v","5"]
      : ["-c:v","libx264","-preset","ultrafast"];
  const format = extension === "m4v" ? ["-f","ipod","-brand","M4V "] : [];
  execFileSync("ffmpeg",["-hide_banner","-loglevel","error","-f","lavfi","-i",
    "testsrc2=size=320x240:rate=12","-t","1",...codec,"-pix_fmt","yuv420p",...format,path],{timeout:30000});
}
