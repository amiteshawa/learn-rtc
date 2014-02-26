This code is optimized for "making it work" and "learning web RTC". 

__Floow these steps:__

```sh
$ curl https://gist.githubusercontent.com/amiteshawa/9230208/raw/d3678ee541ac1278442bd440b0a74f5e1a00c0de/chat-server.js > chat-server.js

$ npm install websocket

$ node chat-server.js
```

__For video and text share:__

* Edit the IPs/Hosts for stun, turn and websocket in init function of `rtc.js`

* Host the code in a webserver.

* For data channel open `text-share.html` in different chrome tabs.

* For video share open `video-share.html` in different chrome tabs.






