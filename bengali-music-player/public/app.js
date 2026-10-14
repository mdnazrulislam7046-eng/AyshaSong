(function () {
  "use strict";

  /* ---------- Helpers ---------- */
  var $ = function (id) { return document.getElementById(id); };
  var AUDIO_DIR = "audio/";

  // Title = original file name, with ONLY the ".ogg" extension removed.
  function titleOf(file) { return file.replace(/\.ogg$/i, ""); }
  // encodeURIComponent keeps spaces / Bengali / special characters safe in URLs.
  function urlOf(file) { return AUDIO_DIR + encodeURIComponent(file); }
  function fmt(sec) {
    if (!isFinite(sec) || sec < 0) return "0:00";
    var m = Math.floor(sec / 60);
    var s = Math.floor(sec % 60);
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  /* ---------- State ---------- */
  var files = (window.SONG_FILES || []).slice();
  var songs = files.map(function (f) {
    return { file: f, title: titleOf(f), url: urlOf(f), duration: NaN, failed: false, el: null };
  });
  var current = -1;
  var seeking = false;
  var audio = new Audio();
  audio.preload = "metadata";

  /* ---------- Elements ---------- */
  var listEl = $("songList"), countEl = $("countText"), noticeEl = $("notice");
  var player = $("player"), nowTitle = $("nowTitle"), nowSub = $("nowSub");
  var playBtn = $("playBtn"), prevBtn = $("prevBtn"), nextBtn = $("nextBtn");
  var seek = $("seek"), curTime = $("curTime"), totTime = $("totTime");
  var muteBtn = $("muteBtn"), volume = $("volume");

  var SVG_NOTE = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/></svg>';
  var SVG_PLAY = '<svg class="i-play" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
  var SVG_PAUSE = '<svg class="i-pause" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>';

  /* ---------- Build list ---------- */
  function pad(n) { return n < 10 ? "0" + n : String(n); }

  function buildList() {
    listEl.innerHTML = "";
    songs.forEach(function (song, i) {
      var li = document.createElement("li");
      li.className = "song";

      var num = document.createElement("span");
      num.className = "num";
      num.textContent = pad(i + 1);

      var note = document.createElement("span");
      note.className = "note";
      note.innerHTML = SVG_NOTE + '<span class="eq" aria-hidden="true"><i></i><i></i><i></i></span>';

      var title = document.createElement("span");
      title.className = "title";
      // Exact characters of the title; <wbr> only offers nicer line-break points after "_"
      song.title.split("_").forEach(function (part, k) {
        if (k > 0) { title.appendChild(document.createTextNode("_")); title.appendChild(document.createElement("wbr")); }
        title.appendChild(document.createTextNode(part));
      });

      var dur = document.createElement("span");
      dur.className = "dur";
      dur.textContent = "–:––";

      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "play";
      btn.setAttribute("aria-label", "Play: " + song.title);
      btn.innerHTML = SVG_PLAY + SVG_PAUSE;
      btn.addEventListener("click", function () { selectSong(i); });

      li.appendChild(num); li.appendChild(note); li.appendChild(title);
      li.appendChild(dur); li.appendChild(btn);
      listEl.appendChild(li);

      song.el = li; song.durEl = dur; song.btn = btn;
    });
    countEl.textContent = songs.length
      ? "মোট " + songs.length.toLocaleString("bn-BD") + "টি গান"
      : "কোনো গান পাওয়া যায়নি";
  }

  /* ---------- Durations (read from the real files) ---------- */
  function loadDurations() {
    songs.forEach(function (song) {
      var probe = new Audio();
      probe.preload = "metadata";
      var done = false;

      function finish(d) {
        if (done || !isFinite(d) || d <= 0) return;
        done = true;
        song.duration = d;
        song.durEl.textContent = fmt(d);
        if (songs[current] === song) updateDuration();
        probe.removeAttribute("src"); probe.load();
      }

      probe.addEventListener("loadedmetadata", function () {
        if (isFinite(probe.duration)) { finish(probe.duration); return; }
        // Some browsers report Infinity for Ogg until they seek to the end.
        try { probe.currentTime = 1e7; } catch (e) { /* ignore */ }
      });
      probe.addEventListener("durationchange", function () { finish(probe.duration); });
      probe.addEventListener("error", function () { if (!done) markFailed(song); });
      probe.src = song.url;
    });
  }

  function markFailed(song) {
    song.failed = true;
    song.el.classList.add("error");
    song.durEl.textContent = "ত্রুটি";
  }

  /* ---------- UI sync ---------- */
  function showNotice(msg) {
    if (!msg) { noticeEl.hidden = true; noticeEl.textContent = ""; return; }
    noticeEl.textContent = msg; noticeEl.hidden = false;
  }

  function setPlayingUI(isPlaying) {
    player.classList.toggle("is-playing", isPlaying);
    playBtn.setAttribute("aria-label", isPlaying ? "Pause" : "Play");
    songs.forEach(function (s, i) {
      var active = i === current;
      s.el.classList.toggle("active", active);
      s.el.classList.toggle("playing", active && isPlaying);
      s.btn.setAttribute("aria-label", (active && isPlaying ? "Pause: " : "Play: ") + s.title);
    });
    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
    }
  }

  function setNow(song) {
    nowTitle.textContent = song ? song.title : "একটি গান বেছে নিন";
    nowTitle.title = song ? song.title : "";
    nowSub.classList.remove("err");
    nowSub.textContent = song ? "চলছে" : "Play চাপলেই গান শুরু হবে";
  }

  function setSliderFill(el, pct) { el.style.setProperty("--pct", pct + "%"); }

  function updateDuration() {
    var d = audio.duration;
    if (!isFinite(d) && current >= 0) d = songs[current].duration;
    totTime.textContent = fmt(d);
  }

  function updateProgress() {
    var d = audio.duration, t = audio.currentTime;
    if (!seeking) {
      var v = isFinite(d) && d > 0 ? (t / d) * 1000 : 0;
      seek.value = v;
      setSliderFill(seek, v / 10);
    }
    curTime.textContent = fmt(seeking ? (seek.value / 1000) * (d || 0) : t);
  }

  /* ---------- Playback ---------- */
  function load(i) {
    current = i;
    var song = songs[i];
    audio.pause();           // stop whatever was playing
    audio.src = song.url;    // switch to the new real file
    seek.disabled = false;
    seek.value = 0; setSliderFill(seek, 0);
    curTime.textContent = "0:00";
    totTime.textContent = fmt(song.duration);
    setNow(song);
    showNotice("");
    updateMediaSession(song);
  }

  function safePlay() {
    var p = audio.play();
    if (p && typeof p.catch === "function") {
      p.catch(function (err) {
        if (err && err.name === "AbortError") return; // interrupted by another selection
        if (err && err.name === "NotAllowedError") {
          setPlayingUI(false);
          nowSub.textContent = "Play বাটনে চাপ দিন";
          return;
        }
        handleError();
      });
    }
  }

  function selectSong(i) {
    if (i < 0 || i >= songs.length) return;
    if (i === current) { togglePlay(); return; }
    load(i);
    safePlay();
  }

  function togglePlay() {
    if (current < 0) { if (songs.length) selectSong(0); return; }
    if (audio.paused) safePlay(); else audio.pause();
  }

  function next(auto) {
    if (!songs.length) return;
    if (current < 0) { selectSong(0); return; }
    var n = current + 1;
    if (n >= songs.length) {
      if (auto) { // finished the last song: stop and rewind
        audio.currentTime = 0; setPlayingUI(false); updateProgress(); return;
      }
      n = 0;
    }
    selectSong(n);
  }

  function prev() {
    if (!songs.length) return;
    if (current < 0) { selectSong(songs.length - 1); return; }
    if (audio.currentTime > 3) { audio.currentTime = 0; return; }
    selectSong(current === 0 ? songs.length - 1 : current - 1);
  }

  function handleError() {
    if (current < 0) return;
    var song = songs[current];
    markFailed(song);
    setPlayingUI(false);
    nowSub.classList.add("err");
    nowSub.textContent = "ফাইলটি চালানো যায়নি";
    showNotice("দুঃখিত, “" + song.title + "” চালানো যায়নি। ফাইলটি audio ফোল্ডারে আছে কি না দেখুন।");
  }

  /* ---------- Media Session (lock-screen controls) ---------- */
  function updateMediaSession(song) {
    if (!("mediaSession" in navigator) || typeof MediaMetadata === "undefined") return;
    navigator.mediaSession.metadata = new MediaMetadata({ title: song.title, artist: "আমার গান" });
  }
  if ("mediaSession" in navigator) {
    try {
      navigator.mediaSession.setActionHandler("play", function () { togglePlay(); });
      navigator.mediaSession.setActionHandler("pause", function () { audio.pause(); });
      navigator.mediaSession.setActionHandler("previoustrack", prev);
      navigator.mediaSession.setActionHandler("nexttrack", function () { next(false); });
    } catch (e) { /* not supported */ }
  }

  /* ---------- Audio events ---------- */
  audio.addEventListener("play", function () { setPlayingUI(true); });
  audio.addEventListener("pause", function () { setPlayingUI(false); });
  audio.addEventListener("ended", function () { next(true); });
  audio.addEventListener("timeupdate", updateProgress);
  audio.addEventListener("loadedmetadata", function () {
    if (current >= 0 && isFinite(audio.duration)) {
      songs[current].duration = audio.duration;
      songs[current].durEl.textContent = fmt(audio.duration);
    }
    updateDuration();
  });
  audio.addEventListener("durationchange", updateDuration);
  audio.addEventListener("error", function () { if (audio.getAttribute("src")) handleError(); });

  /* ---------- Controls ---------- */
  playBtn.addEventListener("click", togglePlay);
  nextBtn.addEventListener("click", function () { next(false); });
  prevBtn.addEventListener("click", prev);

  seek.addEventListener("input", function () {
    seeking = true;
    setSliderFill(seek, seek.value / 10);
    curTime.textContent = fmt((seek.value / 1000) * (audio.duration || 0));
  });
  seek.addEventListener("change", function () {
    if (isFinite(audio.duration)) audio.currentTime = (seek.value / 1000) * audio.duration;
    seeking = false;
    updateProgress();
  });

  function syncVolumeUI() {
    var muted = audio.muted || audio.volume === 0;
    player.classList.toggle("is-muted", muted);
    muteBtn.setAttribute("aria-label", muted ? "আনমিউট" : "মিউট");
    setSliderFill(volume, muted ? 0 : volume.value);
  }
  volume.addEventListener("input", function () {
    audio.volume = volume.value / 100;
    if (audio.volume > 0) audio.muted = false;
    syncVolumeUI();
  });
  muteBtn.addEventListener("click", function () {
    if (audio.volume === 0) { audio.volume = 0.5; volume.value = 50; audio.muted = false; }
    else audio.muted = !audio.muted;
    syncVolumeUI();
  });

  // Space bar toggles play/pause (unless a button or slider is focused)
  document.addEventListener("keydown", function (e) {
    if (e.code !== "Space") return;
    var tag = (document.activeElement && document.activeElement.tagName) || "";
    if (tag === "BUTTON" || tag === "INPUT") return;
    e.preventDefault(); togglePlay();
  });

  /* ---------- Init (no autoplay) ---------- */
  audio.volume = volume.value / 100;
  buildList();
  syncVolumeUI();
  setSliderFill(seek, 0);
  setPlayingUI(false);
  loadDurations();
})();
