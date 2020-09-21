define([
	"jquery",
	"underscore",

    "WebRTC_SDK/RTCManager",

    // Sample App src files
    "scripts/defaultRTCParams",
    "scripts/bjn-global",
    "scripts/webrtcclientsdk",
	"scripts/webrtcroster"

], function($, _, RTCManager, defaultRTCParams, BJN, RTCClient, RTCRoster ) {

    console.log("(example.js): BJN WebRTC Example");
	
	$("#joinMeeting, #leaveMeeting").click(function(){
		$(this).addClass("hidden");
		$(this).siblings().removeClass("hidden");
	});
	$("#toggleVideoMute, #toggleAudioMute").click(function(){
		$(this).toggleClass("muted");
	});

	
	initializeBJN = function() {
		console.log("(example.js) InitializeBJN()");

		// Initiate BJN SDK, refer defaultRTCParams.js 
		// Add timeout values
		BJN.RTCManager = new RTCManager({
					webrtcParams: defaultRTCParams,
					bjnCloudTimeout : 5000,
					bjnSIPTimeout : 3000,
					bjnWebRTCReconnectTimeout : 90000});
					
		if(RTCClient.version){
			var v = RTCClient.version();
			$("#sdkversion").text( v.major + "." + v.minor + "." + v.build );
		} else {
			$("#sdkversion").text("-- unknown --");
		}

		// setup for roster
		RTCRoster.initialize();
		BJN.RTCRoster = RTCRoster;
		BJN.RTCRoster.onJoin(true,cbPartyJoined);
		BJN.RTCRoster.onLeave(true,cbPartyLeft);
		BJN.RTCRoster.onChange(true,"isSendingVideo",cbPartyToggledVideo);
		BJN.RTCRoster.onChange(true,"isSendingAudio",cbPartyToggledAudio);
		RemoteVideoOrMask();
		

		// Get list of A/V on this PC
		BJN.RTCManager.getLocalDevices().then(function(devices) {
			BJN.localDevices = devices.available;
			var avail = devices.available
			console.log("Got local devices, available:" + JSON.stringify(avail).substr(0,35)+"...");
			
			// Add audio in devices to the selection list
			avail.audioIn.forEach( function(device) {
				console.log("audioIn device: " + device.label);
				$('#audioIn').append('<option>' + device.label +'</option>');
			});
			avail.audioOut.forEach(function(device) {
				$('#audioOut').append('<option>' + device.label +'</option>');
			});
			avail.videoIn.forEach(function(device) {
				$('#videoIn').append('<option>' + device.label +'</option>');
			});
			/*
			   options : {
				   localVideoEl  : <DOM element for local video>,
				   remoteVideoEl : <DOM element for remote video>
				   contentVideoEl: <DOM element for content share video>
				   bandWidth     : <100..4096Kbps netwk b/w>
				   devices       : { object - full list of Audio/Video devices
				   evtVideoUnmute  : <function handler>
				   evtRemoteConnectionStateChange : <function handler>
				   evtLocalConnectionStateChange : <function handler>
				   evtOnError : <function handler>
				   evtContentShareStateChange : <function handler> v1.1.0				   
				}
			*/
			RTCClient.initialize({
				localVideoEl: $("#localVideo")[0],
				remoteVideoEl : $("#remoteVideo")[0],
				remoteAudioEl : $("#remoteAudio")[0],
				contentVideoEl : $("#contentVideo")[0],
				bandWidth : $("#videoBw").prop('value'),
				devices   : BJN.localDevices,
				evtVideoUnmute : unmuteVideo,
				evtRemoteConnectionStateChange : null,
				evtLocalConnectionStateChange : null,
				evtOnError : null,
				evtContentShareStateChange : cbContentShareStateChange
			});
			
			// Save for external access
			BJN.RTCClient = RTCClient;	
			setTimeout(() => {
        console.log("Raydiant: Clicking mute button");
        $("#toggleAudioMute").click();
      }, 100);

		}, function(error) {
			console.log("Local device error " + error);
			reject(error);
		});
	}
	
	function unmuteVideo() {
		setMuteButton(false);
	};

	function setMuteButton(muted){
		var updatedText = muted ? "Show Video" : "Mute Video";
		$("#toggleVideoMute").html(updatedText);	
	};
	
	function cbContentShareStateChange(isShare){
		if(isShare){
			$("#contentVideo").show();
			$("#noContent").hide();
		} else {
			$("#contentVideo").hide();
			$("#noContent").show();
		}
	}
	
	//------------------
	// BlueJeans Roster Related UI Functions
	//
	// vvv vvv vvv
	
	function PartyVideoMuted(p) {
		return (p.attributes.isSendingVideo ? 
				  "<img src='media/vcam.png'/>" :
		            " ");
	}


	function PartyAudioMuted(p) {
		return (p.attributes.isSendingAudio ? 
				  "<img src='media/mic.png'/>" :
		            " ");
	}

	function RemoteVideoOrMask(){
		var n = BJN.RTCRoster.getPartyCount();
		switch(n) {
			case 0: // no one in mtg
			  $("#remoteVideo").hide();
			  $("#waitimg").hide();
			  $("#waittext").hide();
			  $("#wait4agent").show();
			break;
			case 1: // just me
			  $("#remoteVideo").hide();
			  $("#wait4agent").show();
			  $("#waitimg").css('display','block').show();
			  $("#waittext").show();
			break;
			default: // everyone
			  $("#remoteVideo").show();
			  $("#waitimg").hide();
			  $("#waittext").hide();
			  $("#wait4agent").hide();
			break;
		} 
	}	
	
	function cbPartyJoined(p){
		var r = '<tr id="' + p.cid + '">';
		r += "<td class='rostern'>" + 
		  p.attributes.name + "</td>";
		r += "<td class='rosterv'>" + 
		    PartyVideoMuted(p)  +
		    "</td>";
		r += "<td class='rostera'>" + 
		    PartyAudioMuted(p)  +
		    "</td>";
		r += "</tr>";
			
		$("#parties tr:last").after(r);
		RemoteVideoOrMask();
	}
	
	function cbPartyLeft(p){
		$('table#parties tr#'+p.cid).remove();
		RemoteVideoOrMask();
	}
	
	function cbPartyToggledVideo(p){
		$('table#parties tr#'+p.cid+' td.rosterv').html( PartyVideoMuted(p) );
	}
	
	function cbPartyToggledAudio(p){
		$('table#parties tr#'+p.cid+' td.rostera').html( PartyAudioMuted(p) );
	}


	maptoUI = function() {
		console.log("(example.js) maptoUI()");
		// Device and Connection UI Handlers
		$("#audioIn").change( function() {
			var who = $("#audioIn").prop('selectedIndex');
			console.log("UI: audio input changed: " + who);
			RTCClient.changeAudioInput(who);
		});

		$("#audioOut").change( function() {
			var who = $("#audioOut").prop('selectedIndex');
			console.log("UI: audio output changed: " + who );
			RTCClient.changeAudioOutput(who);
		});

		$("#videoIn").change( function() {
			var who = $("#videoIn").prop('selectedIndex');
			console.log("UI: video input changed: " + who );
			RTCClient.changeVideoInput(who);
		});

		$("#videoBw").change( function() {
			var bw = $("#videoBw").prop('value');
			console.log("UI: Video BW is changed " + bw);
			RTCClient.setVideoBandwidth(bw);
		});


		// Mute UI handlers
		$("#toggleAudioMute").click(function() {
			var muted = RTCClient.toggleAudioMute();
			var updatedText = muted ? "Unmute Audio" : "Mute Audio";
			$("#toggleAudioMute").html(updatedText);
			console.log(muted ? "Audio is Muted now" : "Audio is Unmuted now");	
		});

		$("#toggleVideoMute").click(function() {
			var muted = RTCClient.toggleVideoMute();
			if(muted)
				setMuteButton(muted);
		});


		// Meeting UI handlers
		$("#joinMeeting").click(function() {
			var meetingParams = {
				numericMeetingId   : $('#id').val(),
				attendeePasscode    : $('#passCode').val(),
				displayName : $('#yourName').val()
			};
			RTCClient.joinMeeting(meetingParams);
		});

		$("#leaveMeeting").click(function() {
			RTCClient.leaveMeeting();
			RTCRoster.close();
		});
	}
	
	console.log("Startng Initialization of BJN");
	initializeBJN();
	maptoUI();

});
