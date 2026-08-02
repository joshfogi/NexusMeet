const socket = io('/');
const videoGrid = document.getElementById('videoGrid');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const micBtn = document.getElementById('micBtn');
const camBtn = document.getElementById('camBtn');
const flipCamBtn = document.getElementById('flipCamBtn');
const captionBtn = document.getElementById('captionBtn');
const themeSelector = document.getElementById('themeSelector');
const langSelector = document.getElementById('langSelector');
const copyLinkBtn = document.getElementById('copyLinkBtn');
const captionOverlay = document.getElementById('captionOverlay');

const myVideo = document.createElement('video');
myVideo.muted = true;
myVideo.classList.add('local-video');

let myStream;
let currentFacingMode = 'user';
let peers = {};
let speechRecognition = null;
let captionsEnabled = false;

let roomId = window.location.pathname.substring(1);
if (!roomId) {
  roomId = Math.random().toString(36).substring(2, 9);
  window.history.pushState({}, '', `/${roomId}`);
}

const myPeer = new Peer(undefined, {
  host: '/',
  port: location.port || (location.protocol === 'https:' ? 443 : 80),
  path: '/peerjs'
});

myPeer.on('open', (id) => {
  initLocalStream().then(() => {
    socket.emit('join-room', roomId, id);
  });
});

async function initLocalStream() {
  try {
    if (myStream) {
      myStream.getTracks().forEach(track => track.stop());
    }
    myStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: currentFacingMode },
      audio: true
    });
    addVideoStream(myVideo, myStream);

    myPeer.on('call', (call) => {
      call.answer(myStream);
      const video = document.createElement('video');
      call.on('stream', (userVideoStream) => {
        addVideoStream(video, userVideoStream);
      });
      peers[call.peer] = call;
    });

    socket.on('user-connected', (userId) => {
      connectToNewUser(userId, myStream);
    });
  } catch (err) {
    console.error('Failed to access media devices:', err);
  }
}

function connectToNewUser(userId, stream) {
  const call = myPeer.call(userId, stream);
  const video = document.createElement('video');
  call.on('stream', (userVideoStream) => {
    addVideoStream(video, userVideoStream);
  });
  call.on('close', () => {
    video.remove();
  });
  peers[userId] = call;
}

function addVideoStream(video, stream) {
  video.srcObject = stream;
  video.addEventListener('loadedmetadata', () => {
    video.play();
  });
  videoGrid.append(video);
}

socket.on('user-disconnected', (userId) => {
  if (peers[userId]) peers[userId].close();
});

micBtn.addEventListener('click', () => {
  const audioTrack = myStream.getAudioTracks()[0];
  if (audioTrack) {
    audioTrack.enabled = !audioTrack.enabled;
    micBtn.classList.toggle('off', !audioTrack.enabled);
  }
});

camBtn.addEventListener('click', () => {
  const videoTrack = myStream.getVideoTracks()[0];
  if (videoTrack) {
    videoTrack.enabled = !videoTrack.enabled;
    camBtn.classList.toggle('off', !videoTrack.enabled);
  }
});

flipCamBtn.addEventListener('click', async () => {
  currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
  await initLocalStream();
});

themeSelector.addEventListener('change', (e) => {
  document.documentElement.setAttribute('data-theme', e.target.value);
});

copyLinkBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(window.location.href);
  alert('Room link copied!');
});

sendBtn.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});

function sendMessage() {
  const text = chatInput.value.trim();
  if (!text) return;

  socket.emit('chat-message', {
    sender: 'Peer',
    text: text,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  });
  chatInput.value = '';
}

socket.on('chat-message', async (data) => {
  const targetLang = langSelector.value;
  const translated = await simulateTranslation(data.text, targetLang);
  
  const msgEl = document.createElement('div');
  msgEl.classList.add('message');
  msgEl.innerHTML = `
    <div class="sender">${data.sender} • ${data.timestamp}</div>
    <div>${data.text}</div>
    <div class="translated-text">🌐 (${targetLang.toUpperCase()}): ${translated}</div>
  `;
  
  chatMessages.appendChild(msgEl);
  chatMessages.scrollTop = chatMessages.scrollHeight;
});

async function simulateTranslation(text, targetLang) {
  const dict = {
    es: { "hello": "hola", "hi": "hola", "how are you": "cómo estás", "welcome": "bienvenido" },
    fr: { "hello": "bonjour", "hi": "salut", "how are you": "comment ça va", "welcome": "bienvenue" },
    de: { "hello": "hallo", "hi": "hallo", "how are you": "wie geht es dir", "welcome": "willkommen" },
    ja: { "hello": "こんにちは", "hi": "やあ", "how are you": "お元気ですか", "welcome": "ようこそ" }
  };
  const lower = text.toLowerCase().trim();
  return (dict[targetLang] && dict[targetLang][lower]) ? dict[targetLang][lower] : `[${targetLang.toUpperCase()}] ${text}`;
}

if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  speechRecognition = new SpeechRecognition();
  speechRecognition.continuous = true;
  speechRecognition.interimResults = true;

  speechRecognition.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      interim += event.results[i][0].transcript;
    }
    if (captionsEnabled && interim) {
      captionOverlay.innerText = interim;
    }
  };
}

captionBtn.addEventListener('click', () => {
  captionsEnabled = !captionsEnabled;
  captionBtn.classList.toggle('off', !captionsEnabled);
  captionOverlay.style.display = captionsEnabled ? 'block' : 'none';
  if (speechRecognition) {
    captionsEnabled ? speechRecognition.start() : speechRecognition.stop();
  }
});
      
