var TextShare = (function () {
    var userid,
        offerPeer,
        answerPeer,
        STUN,
        TURN,
        websocket,
        config = {},
        rooms,
        invite,
        userAndRoomMap,
        status,
        type,
        interval,
        channel;

    var init = function () {
            websocket = new WebSocket('ws://127.0.0.1:1337');
            STUN = {url: 'stun:stun.l.google.com:19302'};
            //TURN = {url: 'turn:10.0.0.7:3333', credential: 'madhur', username: 'amitesh'};
            //TURN = {url: 'turn:10.0.0.7:3333', credential: 'MmE5NjM4Yjc1ZjZiZTQ1ZjhkYzlmMmU4Yjc1NzBlY2Q1YzViZGU1Zg==', username: '1393139326:amitesh'};

			TURN = {"username":"amitesh:1393412082","credential":"NGFmNGRlMjIxOWZmMTVjMzMxMDliYzUzZDIxOWE1OWI0NTBmZGZiNg==","url":"turn:10.0.0.2:3333?transport=udp"};




            config.iceServers = [STUN, TURN];

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
            rooms.innerHTML = '<span>' + data.roomid + '</span>' +
                '<button class="join" onclick="TextShare.join(\'' + data.roomid + '\')">Join</button>';
            invite.style.display = 'none';
            clearInterval(interval);
        },
        startSignaling = function(callback) {
            websocket.onopen = function () {
                websocket.send(JSON.stringify({start: true}));
            };
            websocket.onmessage = function (e) {
                console.log("got", e.data);
                callback(JSON.parse(e.data));
            };
            return websocket;
        },
        renderUI = function(){
            rooms.innerHTML = "Connected ....";
            document.getElementById("container").style.display = "block";
            document.getElementById("log").style.display = "block";
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
                console.log("Creating Offer");
                createOffer(data);
                type = "Offer";
            }
        },
        createInvite = function(room) {
            interval = setInterval(function(){
                var object = {"roomid": room, "source": userid};
                websocket.send(JSON.stringify(object));
            }, 1000);
            rooms.innerHTML = 'Waiting....';
            invite.style.display = 'none';
            status = "waiting";
        },
        join = function (roomid) {
            console.log(userAndRoomMap);
            var room = userAndRoomMap[roomid];
            var object = {"target": userid, "roomid": room.roomid, "source": room.source, "status": 'createOffer'};
            websocket.send(JSON.stringify(object));
            status = "creatingOffer";
        },
        openDataChannel = function(peer){
            try {
                // Reliable Data Channels not yet supported in Chrome
                channel = peer.createDataChannel("sendDataChannel", {reliable: false});
            } catch (e) {
                console.log('DataChannel : ', e);
            }
            channel.onopen = manageChannel;
            channel.onclose = manageChannel;
        },
        createOffer = function(data) {
            offerPeer = new window.webkitRTCPeerConnection(config,  {optional: [{RtpDataChannels: true}]});

            openDataChannel(offerPeer);

            offerPeer.onicecandidate = function (event) {
                if (!event.candidate) {
                    var object = {"sdp": offerPeer.localDescription, "target": data.source, "source": userid, "roomid": data.roomid, "status": "sdp"};
                    websocket.send(JSON.stringify(object));
                }
            };
            offerPeer.createOffer(function(sdp) { offerPeer.setLocalDescription(sdp); });
            console.log(offerPeer);
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
            answerPeer = new window.webkitRTCPeerConnection(config,  {optional: [{RtpDataChannels: true}]});
            openDataChannel(answerPeer);

            answerPeer.onicecandidate = function(event) {
                var object = {"candidate": event.candidate, "target": data.source, "source": userid, "roomid": data.roomid, "status": "candidate"};
                websocket.send(JSON.stringify(object));
            };

            answerPeer.setRemoteDescription(new RTCSessionDescription(data.sdp));

            answerPeer.createAnswer(function(sdp) {
                answerPeer.setLocalDescription(sdp);
                var object = {"sdp": sdp, "target": data.source, "source": userid, "roomid": data.roomid, "status": "sdp"};
                websocket.send(JSON.stringify(object));
            });

            console.log(answerPeer);
        },
        addAnswerIceCandidate = function(candidate) {
            answerPeer.addIceCandidate(new RTCIceCandidate({
                sdpMLineIndex: candidate.sdpMLineIndex,
                candidate: candidate.candidate,
                sdpMid: candidate.sdpMid
            }));
        },
        sendData = function(){
            var obj;
            obj = document.getElementById('text');
            channel.send(obj.value);
            document.getElementById('log').innerHTML += '<div id="mytext">Me: ' + obj.value + '</div>';
            obj.value = "";
            obj.focus();
        },
        onMsg = function(e){
            document.getElementById('log').innerHTML += '<div id="histext">He: ' + e.data + '</div>';
        },
        manageChannel = function(){
            console.log("CHANNEL STATE CHANGEED", channel);
            if (channel.readyState === "open") {
                channel.onmessage = onMsg;
                renderUI();
            }
        };
    return{
        init: init,
        createInvite: createInvite,
        join: join,
        send: sendData
    };
}());