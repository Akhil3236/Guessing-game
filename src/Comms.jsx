/**
 * Comms — in-game text chat and peer-to-peer voice chat.
 *
 * Text chat rides the existing game WebSocket: a `chat` message is relayed
 * by the server to both players. Voice chat is a direct WebRTC audio link;
 * only the handshake (SDP + ICE) travels over the socket, as `signal`
 * messages. The component mounts once a game starts and stays mounted
 * across rematches, so a call survives a "Play again".
 */
import { useEffect, useRef, useState } from 'react';

const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export default function Comms({ send, you, players }) {
  const opp = players[1 - you]?.name || 'Opponent';

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [unread, setUnread] = useState(0);
  const [micState, setMicState] = useState('idle'); // idle | starting | on | muted | error
  const [voiceConn, setVoiceConn] = useState('idle'); // idle | connecting | live | failed
  const [remoteJoined, setRemoteJoined] = useState(false);

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const audioRef = useRef(null);
  const listRef = useRef(null);
  const openRef = useRef(open);
  const idRef = useRef(0);
  const makingOffer = useRef(false);
  const ignoreOffer = useRef(false);
  const remoteAnnounced = useRef(false);
  const failAnnounced = useRef(false);

  openRef.current = open;
  const polite = you === 1; // perfect-negotiation roles: P2 yields on a clash

  const pushSystem = (text) =>
    setMessages((prev) => [...prev, { id: `s${(idRef.current += 1)}`, system: true, text }]);

  // --- WebRTC ----------------------------------------------------------

  function getPeer() {
    if (pcRef.current) return pcRef.current;
    const pc = new RTCPeerConnection(RTC_CONFIG);

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) send({ type: 'signal', signal: { candidate } });
    };
    pc.onnegotiationneeded = async () => {
      try {
        makingOffer.current = true;
        await pc.setLocalDescription();
        send({ type: 'signal', signal: { description: pc.localDescription } });
      } catch {
        /* a transient negotiation error — ICE will retry */
      } finally {
        makingOffer.current = false;
      }
    };
    pc.ontrack = ({ streams }) => {
      if (audioRef.current && streams[0]) {
        audioRef.current.srcObject = streams[0];
        audioRef.current.play?.().catch(() => {});
      }
      setRemoteJoined(true);
      if (!remoteAnnounced.current) {
        remoteAnnounced.current = true;
        pushSystem(`🔊 ${opp} joined voice chat.`);
      }
    };
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === 'connected') setVoiceConn('live');
      else if (s === 'connecting' || s === 'new') setVoiceConn('connecting');
      else if (s === 'disconnected') setVoiceConn('connecting');
      else if (s === 'closed') setVoiceConn('idle');
      else if (s === 'failed') {
        setVoiceConn('failed');
        if (!failAnnounced.current) {
          failAnnounced.current = true;
          pushSystem("⚠️ Voice couldn't connect — text chat still works.");
        }
      }
    };

    pcRef.current = pc;
    return pc;
  }

  async function handleSignal(signal) {
    if (!signal) return;
    const pc = getPeer();
    try {
      if (signal.description) {
        const desc = signal.description;
        const collision =
          desc.type === 'offer' && (makingOffer.current || pc.signalingState !== 'stable');
        ignoreOffer.current = !polite && collision;
        if (ignoreOffer.current) return;
        await pc.setRemoteDescription(desc);
        if (desc.type === 'offer') {
          await pc.setLocalDescription();
          send({ type: 'signal', signal: { description: pc.localDescription } });
        }
      } else if (signal.candidate) {
        try {
          await pc.addIceCandidate(signal.candidate);
        } catch (err) {
          if (!ignoreOffer.current) throw err;
        }
      }
    } catch {
      /* ignore — a dropped candidate is recoverable */
    }
  }

  const signalRef = useRef(handleSignal);
  signalRef.current = handleSignal;

  async function toggleVoice() {
    // Already running — just flip the local track on or off (no renegotiation).
    if (micState === 'on' || micState === 'muted') {
      const enable = micState === 'muted';
      localStreamRef.current?.getTracks().forEach((t) => {
        t.enabled = enable;
      });
      setMicState(enable ? 'on' : 'muted');
      return;
    }
    // First time: ask for the mic and add it to the peer connection.
    setMicState('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      localStreamRef.current = stream;
      const pc = getPeer();
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      setMicState('on');
      setVoiceConn((v) => (v === 'idle' ? 'connecting' : v));
      pushSystem('🎙️ You joined voice chat.');
      if (!open) setOpen(true);
    } catch {
      setMicState('error');
      pushSystem('⚠️ Microphone blocked — allow mic access in your browser.');
    }
  }

  // --- wiring ----------------------------------------------------------

  useEffect(() => {
    const onChat = (e) => {
      const m = e.detail || {};
      setMessages((prev) => [
        ...prev,
        { id: `m${(idRef.current += 1)}`, from: m.from, name: m.name, text: m.text },
      ]);
      if (!openRef.current) setUnread((u) => u + 1);
    };
    const onSignal = (e) => signalRef.current(e.detail?.signal);
    window.addEventListener('arcade-chat', onChat);
    window.addEventListener('arcade-signal', onSignal);
    return () => {
      window.removeEventListener('arcade-chat', onChat);
      window.removeEventListener('arcade-signal', onSignal);
    };
  }, []);

  // Tear down the call when the game is left.
  useEffect(
    () => () => {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      pcRef.current?.close();
    },
    [],
  );

  useEffect(() => {
    if (open) setUnread(0);
  }, [open]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, open]);

  const sendChat = (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    send({ type: 'chat', text });
    setDraft('');
  };

  // --- render ----------------------------------------------------------

  const micLabel = {
    idle: '🎤 Voice',
    starting: '⏳ Connecting',
    on: '🎙️ Mic live',
    muted: '🔇 Muted',
    error: '🎤 Retry mic',
  }[micState];

  const voicing = micState === 'on' || micState === 'muted';
  let voiceStatus = null;
  if (voiceConn === 'failed') {
    voiceStatus = "Voice unavailable — your networks couldn't reach each other.";
  } else if (remoteJoined && voicing) {
    voiceStatus = `🔊 In voice with ${opp}.`;
  } else if (remoteJoined) {
    voiceStatus = `🔊 ${opp} is in voice — tap "Voice" to talk back.`;
  } else if (voicing) {
    voiceStatus = `Waiting for ${opp} to join voice…`;
  }

  return (
    <section className={`comms ${open ? 'open' : ''}`}>
      <div className="comms-bar">
        <button type="button" className="comms-toggle" onClick={() => setOpen((o) => !o)}>
          <span>💬 Chat</span>
          {!open && unread > 0 && <span className="comms-badge">{unread}</span>}
          <span className="comms-caret">{open ? '▾' : '▸'}</span>
        </button>
        <button
          type="button"
          className={`comms-mic mic-${micState}`}
          onClick={toggleVoice}
          disabled={micState === 'starting'}
        >
          {micLabel}
        </button>
      </div>

      {open && (
        <div className="comms-body">
          {voiceStatus && (
            <p className={`comms-voice ${voiceConn === 'failed' ? 'bad' : ''}`}>{voiceStatus}</p>
          )}
          <div className="comms-log" ref={listRef}>
            {messages.length === 0 ? (
              <p className="comms-empty">Say hi 👋 — messages stay between you two.</p>
            ) : (
              messages.map((m) =>
                m.system ? (
                  <p key={m.id} className="comms-sys">
                    {m.text}
                  </p>
                ) : (
                  <div
                    key={m.id}
                    className={`comms-msg ${m.from === you ? 'mine' : 'theirs'}`}
                  >
                    {m.from !== you && <span className="comms-from">{m.name}</span>}
                    <span className="comms-text">{m.text}</span>
                  </div>
                ),
              )
            )}
          </div>
          <form className="comms-input" onSubmit={sendChat}>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, 500))}
              placeholder={`Message ${opp}…`}
              maxLength={500}
              autoComplete="off"
            />
            <button className="btn primary" type="submit" disabled={!draft.trim()}>
              Send
            </button>
          </form>
        </div>
      )}

      {/* Remote voice — kept mounted so audio plays even when chat is closed. */}
      <audio ref={audioRef} autoPlay />
    </section>
  );
}
