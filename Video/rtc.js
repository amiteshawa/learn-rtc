var VideoChat = (function() {
    var userid,
        offerPeer,
        answerPeer,
        STUN,
        TURN,
        websocket,
        config = {},
        mystream,
        rooms,
        invite,
        userAndRoomMap,
        status,
        type,
        mediaConstraints,
        interval;

    var init = function () {
            websocket = new WebSocket('ws://127.0.0.1:1337');
            STUN = {url: 'stun:stun.l.google.com:19302'};
            TURN = {"username":"user1:1393105096","credential":"NGFmNGRlMjIxOWZmMTVjMzMxMDliYzUzZDIxOWE1OWI0NTBmZGZiNg==","url":"turn:10.0.0.7:3333?transport=udp"};
            config.iceServers = [STUN, TURN];

            mediaConstraints = {
                "mandatory": {
                    "OfferToReceiveVideo" : true,
                    "OfferToReceiveAudio" : true
                }
            };
            // http://<URL>/video.html?email=<YourEmail>
            userid = window.location.search.substring(7) || Math.round((Math.random() * 1e6) | 0);

            rooms = document.getElementById('rooms');
            invite = document.getElementById('invite');

            userAndRoomMap = {};
            status = 'not-joined';
            type = null;
            document.getElementById("iam").innerHTML = userid;
            websocket = startSignaling(checkInvites);
        },
        renderJoinButton = function (data) {
            if (status !== "not-joined") return true;
            userAndRoomMap[data.roomid] = data;
            rooms.innerHTML = '<div>' + data.roomid + '</div>' +
                '<button class="join" onclick="VideoChat.join(\''+data.roomid+'\')">Join</button>';
            invite.style.display = 'none';
        },

        startSignaling = function(callback) {
            websocket.onopen = function () {
                websocket.send(JSON.stringify({start: true}));
            };
            websocket.onmessage = function (e) {
                callback(JSON.parse(e.data));
            };

            return websocket;
        },
        checkInvites = function(data) {
            console.log(data);
            if (data.roomid && status === "not-joined") renderJoinButton(data);
            if (data.target !== userid) { return; }
            clearInterval(interval);
            if (data.status === "sdp") {
                var sdp = data.sdp;
                console.log(sdp.type);
                console.log(sdp.sdp);
                if (sdp.type === 'offer') {
                    data.stream = mystream;
                    createAnswer(data);
                    type = "Answer";
                }
                if (sdp.type === 'answer') {
                    setRemoteDescription(sdp);
                }
            }
            if (data.candidate) {
                if (type === "Offer") addOfferIceCandidate(data.candidate);
                if (type === "Answer") addAnswerIceCandidate(data.candidate);
            }
            if (data.status === "createOffer") {
                data.stream = mystream;
                createOffer(data);
                type = "Offer";
            }
        },
        createInvite = function(room) {
            captureUserMedia(function () {
                interval = setInterval(function(){
                    var object = {"roomid": room, "source": userid};
                    websocket.send(JSON.stringify(object));
                }, 1000);
            });

            rooms.style.display = 'none';
            invite.style.display = 'none';
        },
        join = function (roomid) {
            var room = userAndRoomMap[roomid];
            captureUserMedia(function() {
                var object = {"target": userid, "roomid": room.roomid, "source": room.source, "status": 'createOffer'};
                websocket.send(JSON.stringify(object));
                status = "creatingOffer";
            });
            rooms.style.display = 'none';
        },
        captureUserMedia = function(callback) {

            var onsuccess = function (stream) {
                mystream = stream;
                document.getElementById('my').src = window.webkitURL.createObjectURL(stream);
                callback();
            };

            var onerror = function(e) { console.error(e); }

            navigator.webkitGetUserMedia({video: true, audio: true}, onsuccess, onerror);
        },
        createOffer = function(data) {
            offerPeer = new window.webkitRTCPeerConnection(config);
            if (data.stream) { offerPeer.addStream(data.stream); }

            offerPeer.onaddstream = function(obj) {
                document.getElementById('others').src = window.webkitURL.createObjectURL(obj.stream);
            };
            offerPeer.onicecandidate = function (event) {
                if (!event.candidate) {
                    var object = {"sdp": offerPeer.localDescription, "target": data.source, "source": userid, "roomid": data.roomid, "status": "sdp"};
                    websocket.send(JSON.stringify(object));
                }
            };
            offerPeer.createOffer(function(sdp) { offerPeer.setLocalDescription(sdp); }, null, mediaConstraints);
        },
        setRemoteDescription = function (sdp) {
            offerPeer.setRemoteDescription(new RTCSessionDescription(sdp));
        },
        addOfferIceCandidate = function (candidate) {
            offerPeer.addIceCandidate(new RTCIceCandidate({
                sdpMLineIndex: candidate.sdpMLineIndex,
                candidate: candidate.candidate,
                sdpMid: candidate.sdpMid
            }));
        },
        createAnswer = function(data) {
            answerPeer = new window.webkitRTCPeerConnection(config);
            if (data.stream) answerPeer.addStream(data.stream);

            answerPeer.onaddstream = function(obj) {
                document.getElementById('others').src = window.webkitURL.createObjectURL(obj.stream);
            };

            answerPeer.onicecandidate = function(event) {
                var object = {"candidate": event.candidate, "target": data.source, "source": userid, "roomid": data.roomid, "status": "candidate"};
                websocket.send(JSON.stringify(object));
            };

            answerPeer.setRemoteDescription(new RTCSessionDescription(data.sdp));

            answerPeer.createAnswer(function(sdp) {
                answerPeer.setLocalDescription(sdp);
                var object = {"sdp": sdp, "target": data.source, "source": userid, "roomid": data.roomid, "status": "sdp"};
                websocket.send(JSON.stringify(object));
            }, null, mediaConstraints);
        },
        addAnswerIceCandidate = function(candidate) {
            answerPeer.addIceCandidate(new RTCIceCandidate({
                sdpMLineIndex: candidate.sdpMLineIndex,
                candidate: candidate.candidate,
                sdpMid: candidate.sdpMid
            }));
        };
    return{
        init: init,
        createInvite: createInvite,
        join: join
    };
}());