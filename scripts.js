// --- Core Audio Elements ---
const audio = new Audio();
audio.crossOrigin = "anonymous"; // Essential for Web Audio API when loading from different origin or server

// --- Player Control Elements ---
const playPauseBtn = document.getElementById("play-pause");
const progressBar = document.getElementById("progress");
const volumeBar = document.getElementById("volume");
const currentSongDisplay = document.getElementById("current-song");
const songImg = document.getElementById("song-img");
const currentTimeEl = document.getElementById("current-time");
const durationEl = document.getElementById("duration");
const prevBtn = document.getElementById("prev");
const nextBtn = document.getElementById("next");
const rewindBtn = document.getElementById("rewind-10");
const forwardBtn = document.getElementById("forward-10");
const shuffleBtn = document.getElementById("shuffle");
const repeatBtn = document.getElementById("repeat");

// --- Feature Elements ---
const toggleModeBtn = document.getElementById("toggle-mode");
const htmlElement = document.documentElement; // For light/dark mode

const playbackSpeedDropdown = document.getElementById("playbackSpeedDropdown");
const playbackSpeedItems = document.querySelectorAll(".playback-speed-item");
const playbackSpeedDisplay = playbackSpeedDropdown.querySelector(".speed-display");

const sleepTimerDropdown = document.getElementById("sleepTimerDropdown");
const sleepTimerItems = document.querySelectorAll(".sleep-timer-item");
const sleepTimerDisplay = sleepTimerDropdown.querySelector(".timer-display");
let sleepTimerTimeout = null;

const visualizerCanvas = document.getElementById("visualizer");
const canvasCtx = visualizerCanvas.getContext("2d");
let analyser;
let audioCtx;
let source; // Will be initialized in setupWebAudio

// --- Frame and Playlist Management Elements ---
const songsFrame = document.getElementById("songs-frame");
const playlistsFrame = document.getElementById("playlists-frame");
const showSongsBtn = document.getElementById("show-songs-btn");
const showPlaylistsBtn = document.getElementById("show-playlists-btn");

const allSongsList = document.getElementById("all-songs-list"); // Container for all songs (previously named playlistElement)
const playlistList = document.getElementById("playlist-list"); // List of user-defined playlist names
const currentPlaylistSongs = document.getElementById("current-playlist-songs"); // Songs within a selected playlist
const createPlaylistBtn = document.getElementById("create-playlist-btn");
const backToPlaylistsBtn = document.getElementById("back-to-playlists-btn");
const playlistTitleDisplay = document.getElementById("playlist-title"); // Display for current frame/playlist name

// --- Application State Variables ---
let currentIndex = 0; // Index in the `songs` array (global index)
let isPlaying = false;
let isShuffleOn = false;
let repeatMode = 0; // 0: No repeat, 1: Repeat all, 2: Repeat one
let shuffledIndexes = []; // Shuffled indexes based on the *current active song list*
let originalIndexes = Array.from(Array(songs.length).keys()); // All song indexes

let userPlaylists = JSON.parse(localStorage.getItem('userPlaylists')) || [];
let activePlaylistId = null; // Stores the ID of the currently viewed playlist (if any)

// This array will hold the current list of song indexes being played
// It can be `originalIndexes` (all songs) or `currentPlaylistSongsIndexes`
let currentPlaybackList = [];

// --- Initialization ---
function initializePlayer() {
    loadAllSongs(); // Load and display all songs
    // Set initial playback list to all songs
    currentPlaybackList = Array.from(Array(songs.length).keys());
    loadSong(currentIndex); // Load the first song
    pauseSong(); // Start paused
    updateToggleButtonAppearance(); // Set initial theme button text
    audio.volume = volumeBar.value / 100; // Set initial volume
    updateProgressBarFill(volumeBar, volumeBar.value); // Update volume bar styling
    updateRepeatButtonAppearance(); // Set initial repeat button state
    renderPlaylists(); // Render user-defined playlists on startup
    showFrame('songs-frame'); // Default view is 'Songs'
    updateShuffleMode(); // Initialize shuffle state based on currentPlaybackList
}

// --- Player Core Functions ---
function loadSong(songIndex) {
    currentIndex = songIndex; // currentIndex always refers to the global songs array
    const song = songs[currentIndex]; // Access song data from the global `songs` array (from songData.js)
    audio.src = encodeURI(song.src); // Use .src as defined in songData.js
    currentSongDisplay.textContent = song.title;
    songImg.src = song.img;

    updateActiveSongInLists(); // Update active highlights in both 'Songs' and 'Playlist' frames

    progressBar.value = 0;
    updateProgressBarFill(progressBar, 0);
    currentTimeEl.textContent = "0:00";
    durationEl.textContent = "-0:00";
}

function playSong() {
    // Only load song if it's new or not loaded
    if (audio.src === "" || !audio.src.includes(encodeURI(songs[currentIndex].src))) {
        loadSong(currentIndex);
    }

    if (!audioCtx) {
        setupWebAudio();
    } else if (audioCtx.state === "suspended") {
        audioCtx.resume().catch((err) => console.error("Failed to resume AudioContext:", err));
    }

    audio.play()
        .then(() => {
            playPauseBtn.classList.add("playing");
            isPlaying = true;
            startVisualizer();
        })
        .catch((err) => {
            console.error("Failed to play audio:", err);
            alert("Playback failed. Please click Play/Pause or select a song.");
        });
}

function pauseSong() {
    audio.pause();
    playPauseBtn.classList.remove("playing");
    isPlaying = false;
    stopVisualizer();
}

// --- Event Listeners (Player Controls) ---
playPauseBtn.addEventListener("click", () => {
    isPlaying ? pauseSong() : playSong();
});

prevBtn.addEventListener("click", () => {
    navigateSong(-1); // Navigate backwards
});

nextBtn.addEventListener("click", () => {
    navigateSong(1); // Navigate forwards
});

volumeBar.addEventListener("input", () => {
    audio.volume = volumeBar.value / 100;
    updateProgressBarFill(volumeBar, volumeBar.value);
});

audio.addEventListener("timeupdate", () => {
    const { currentTime, duration } = audio;
    if (!isNaN(duration) && duration > 0) {
        const progressPercent = (currentTime / duration) * 100;
        progressBar.value = progressPercent;
        updateProgressBarFill(progressBar, progressPercent);

        currentTimeEl.textContent = formatTime(currentTime);
        const timeLeft = duration - currentTime;
        durationEl.textContent = "-" + formatTime(timeLeft);
    } else {
        progressBar.value = 0;
        updateProgressBarFill(progressBar, 0);
        currentTimeEl.textContent = "0:00";
        durationEl.textContent = "-0:00";
    }
});

audio.addEventListener("ended", () => {
    if (repeatMode === 2) { // Repeat one
        playSong();
    } else if (repeatMode === 1) { // Repeat all
        navigateSong(1, true); // Loop entire current playback list
    } else { // No repeat
        navigateSong(1, false); // Stop when end of current playback list reached
    }
});

progressBar.addEventListener("input", () => {
    if (!isNaN(audio.duration) && audio.duration > 0) {
        const newTime = (progressBar.value / 100) * audio.duration;
        audio.currentTime = newTime;
        updateProgressBarFill(progressBar, progressBar.value);
    }
});

// --- Navigation Logic (Updated) ---
function navigateSong(direction, loop = false) {
    if (currentPlaybackList.length === 0) {
        console.warn("Current playback list is empty. Cannot navigate.");
        pauseSong();
        return;
    }

    let nextIndexInPlaybackList;
    if (isShuffleOn && shuffledIndexes.length > 0) {
        // Find current song in the shuffled list
        const currentPlaybackIndex = shuffledIndexes.indexOf(currentIndex);
        nextIndexInPlaybackList = (currentPlaybackIndex + direction + shuffledIndexes.length) % shuffledIndexes.length;

        if (!loop && direction === 1 && nextIndexInPlaybackList === 0 && currentPlaybackIndex === shuffledIndexes.length - 1) {
            // Reached end of shuffled list, no loop
            pauseSong();
            // Reset to the first song in the shuffled list if not looping
            currentIndex = shuffledIndexes[0];
            loadSong(currentIndex);
            return;
        }
        currentIndex = shuffledIndexes[nextIndexInPlaybackList];
    } else {
        // Find current song in the non-shuffled currentPlaybackList
        const currentPlaybackIndex = currentPlaybackList.indexOf(currentIndex);
        nextIndexInPlaybackList = (currentPlaybackIndex + direction + currentPlaybackList.length) % currentPlaybackList.length;

        if (!loop && direction === 1 && nextIndexInPlaybackList === 0 && currentPlaybackIndex === currentPlaybackList.length - 1) {
            // Reached end of sequential list, no loop
            pauseSong();
            // Reset to the first song in the currentPlaybackList if not looping
            currentIndex = currentPlaybackList[0];
            loadSong(currentIndex);
            return;
        }
        currentIndex = currentPlaybackList[nextIndexInPlaybackList];
    }

    loadSong(currentIndex);
    playSong();
}

// --- Utility Functions ---
function formatTime(sec) {
    if (isNaN(sec) || sec < 0) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? "0" + s : s}`;
}

function updateProgressBarFill(inputElement, percent) {
    inputElement.style.setProperty("--progress-percent", `${percent}%`);
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// --- Feature Implementations ---

// Dark-Light Mode
function updateToggleButtonAppearance() {
    const isLightMode = htmlElement.classList.contains("light-mode");
    toggleModeBtn.innerHTML = isLightMode ? "🌙 Dark Mode" : "☀️ Light Mode";
}

toggleModeBtn.addEventListener("click", () => {
    htmlElement.classList.toggle("light-mode");
    updateToggleButtonAppearance();
    updateProgressBarFill(progressBar, progressBar.value);
    updateProgressBarFill(volumeBar, volumeBar.value * 100); // Reapply fill for volume too
});

// Shuffle Logic (Updated)
function updateShuffleMode() {
    shuffleBtn.classList.toggle("active", isShuffleOn);

    if (isShuffleOn) {
        shuffledIndexes = Array.from(currentPlaybackList); // Shuffle based on currentPlaybackList
        // Remove current song from the rest of the list before shuffling, then add it back to the front
        const currentSongIndexInPlaybackList = shuffledIndexes.indexOf(currentIndex);
        if (currentSongIndexInPlaybackList > -1) {
            shuffledIndexes.splice(currentSongIndexInPlaybackList, 1);
        }
        shuffleArray(shuffledIndexes);
        shuffledIndexes.unshift(currentIndex); // Current song is always first in shuffled list
    } else {
        // When turning shuffle off, currentPlaybackList is already sorted (original order)
        // No need to reset currentIndex, it's already the global index.
    }
    updateActiveSongInLists(); // Re-highlight active song based on new list order
}

shuffleBtn.addEventListener("click", () => {
    isShuffleOn = !isShuffleOn;
    updateShuffleMode(); // Apply shuffle logic
});

// Repeat Logic
function updateRepeatButtonAppearance() {
    repeatBtn.classList.remove("active", "repeat-one");
    if (repeatMode === 1) {
        repeatBtn.classList.add("active"); // Active for Repeat All
    } else if (repeatMode === 2) {
        repeatBtn.classList.add("active", "repeat-one"); // Active and specific class for Repeat One
    }
    // If repeatMode is 0 (none), no classes are added
}

repeatBtn.addEventListener("click", () => {
    repeatMode = (repeatMode + 1) % 3; // Cycle: 0 -> 1 -> 2 -> 0
    updateRepeatButtonAppearance();
});

// Rewind & Forward
rewindBtn.addEventListener("click", () => {
    audio.currentTime = Math.max(0, audio.currentTime - 10); // Rewind 10 seconds, not below 0
});

forwardBtn.addEventListener("click", () => {
    audio.currentTime = Math.min(audio.duration, audio.currentTime + 10); // Forward 10 seconds, not beyond duration
});

// Playback Speed
playbackSpeedItems.forEach((item) => {
    item.addEventListener("click", (e) => {
        e.preventDefault(); // Prevent default link behavior
        const speed = parseFloat(item.dataset.speed);
        audio.playbackRate = speed;
        playbackSpeedDisplay.textContent = speed === 1 ? "1x (Normal)" : `${speed}x Speed`;
    });
});

// Visualizer (Dynamic Audio Waveform)
function setupWebAudio() {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();

    if (!source) {
        source = audioCtx.createMediaElementSource(audio);
        source.connect(analyser);
        analyser.connect(audioCtx.destination);
    }

    analyser.fftSize = 256; // Adjust for more/fewer bars
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    // Get canvas dimensions from HTML attributes
    const canvasWidth = visualizerCanvas.width;
    const canvasHeight = visualizerCanvas.height;

    // Gradient for visualizer bars
    const gradient = canvasCtx.createLinearGradient(0, 0, 0, canvasHeight);
    gradient.addColorStop(0, '#ff0000');
    gradient.addColorStop(0.25, '#ff8c00');
    gradient.addColorStop(0.5, '#ffff00');
    gradient.addColorStop(0.75, '#00ff40');
    gradient.addColorStop(1, '#00f7ff');

    function draw() {
        requestAnimationFrame(draw);

        if (isPlaying) {
            analyser.getByteFrequencyData(dataArray);
            canvasCtx.clearRect(0, 0, canvasWidth, canvasHeight);

            const barSpacing = 2;
            const barWidth = 4;
            // Calculate number of bars that can fit based on canvas width
            const numBars = Math.floor(canvasWidth / (barWidth + barSpacing));

            const midHeight = canvasHeight / 2;

            for (let i = 0; i < numBars; i++) {
                // Scale amplitude to fit visualizer height
                let barAmplitude = dataArray[i];
                let barLength = (barAmplitude / 255) * (midHeight * 0.9); // Max 90% of midHeight

                canvasCtx.fillStyle = gradient;

                const x = i * (barWidth + barSpacing);

                canvasCtx.fillRect(x, midHeight - barLength, barWidth, barLength); // Top half
                canvasCtx.fillRect(x, midHeight, barWidth, barLength); // Bottom half
            }
        } else {
            canvasCtx.clearRect(0, 0, canvasWidth, canvasHeight);
        }
    }
    draw(); // Start the drawing loop
}

function startVisualizer() {
    // Drawing automatically starts/stops based on `isPlaying` flag in `draw()`
}

function stopVisualizer() {
    // Drawing automatically stops based on `isPlaying` flag in `draw()`
}

// Sleep Timer
sleepTimerItems.forEach((item) => {
    item.addEventListener("click", (e) => {
        e.preventDefault();
        const minutes = parseInt(item.dataset.minutes);

        // Clear existing timer if any
        if (sleepTimerTimeout) {
            clearTimeout(sleepTimerTimeout);
            sleepTimerTimeout = null;
            alert("Hẹn giờ đã được hủy.");
            sleepTimerDisplay.textContent = "Hẹn giờ"; // Reset text
        }

        if (minutes > 0) {
            const milliseconds = minutes * 60 * 1000;
            sleepTimerTimeout = setTimeout(() => {
                pauseSong();
                alert(`Hẹn giờ đã hết! Nhạc đã dừng sau ${minutes} phút.`);
                sleepTimerDisplay.textContent = "Hẹn giờ"; // Reset text
            }, milliseconds);
            alert(`Hẹn giờ tắt nhạc sau ${minutes} phút đã được thiết lập.`);
            sleepTimerDisplay.textContent = `Hẹn giờ (${minutes}p)`; // Update display
        } else {
            // For "Turn Off Timer" option (minutes = 0)
            alert("Hẹn giờ tắt nhạc đã được hủy.");
            sleepTimerDisplay.textContent = "Hẹn giờ"; // Reset text
        }
    });
});

// --- Frame Switching Logic (Songs vs. Playlists) ---
function showFrame(frameId) {
    songsFrame.classList.add('d-none');
    playlistsFrame.classList.add('d-none');

    songsFrame.classList.remove('active-frame');
    playlistsFrame.classList.remove('active-frame');

    if (frameId === 'songs-frame') {
        songsFrame.classList.remove('d-none');
        songsFrame.classList.add('active-frame');
        showSongsBtn.classList.add('active');
        showPlaylistsBtn.classList.remove('active');
        // Ensure playlist-specific buttons are hidden when viewing all songs
        backToPlaylistsBtn.classList.add('d-none');
        createPlaylistBtn.classList.add('d-none'); // Hide create button here
        playlistList.classList.add('d-none'); // Hide the main playlist list when showing all songs
        currentPlaylistSongs.classList.add('d-none'); // Hide the song list for a specific playlist
        playlistTitleDisplay.textContent = "Songs"; // Change title as per index.html
        activePlaylistId = null; // No specific playlist is active

        // When switching to 'Songs' frame, the playback list becomes all songs
        currentPlaybackList = Array.from(Array(songs.length).keys());
        updateShuffleMode(); // Re-shuffle/unshuffle based on the new currentPlaybackList
        loadAllSongs(); // Re-render all songs to ensure active state is correct
    } else if (frameId === 'playlists-frame') {
        playlistsFrame.classList.remove('d-none');
        playlistsFrame.classList.add('active-frame');
        showPlaylistsBtn.classList.add('active');
        showSongsBtn.classList.remove('active');
        // When first entering playlist frame, show main playlist list
        backToPlaylistsBtn.classList.add('d-none');
        createPlaylistBtn.classList.remove('d-none'); // Show create button
        playlistList.classList.remove('d-none'); // Show main playlist list
        currentPlaylistSongs.classList.add('d-none'); // Hide specific playlist songs
        playlistTitleDisplay.textContent = "Playlists"; // Change title as per index.html
        activePlaylistId = null; // No specific playlist viewed yet

        // currentPlaybackList is still all songs until a specific playlist is selected
        renderPlaylists(); // Render the main list of playlists
    }
}

showSongsBtn.addEventListener('click', () => showFrame('songs-frame'));
showPlaylistsBtn.addEventListener('click', () => showFrame('playlists-frame'));


// --- Playlist Management ---

// Load and display all songs in the "Songs" frame
function loadAllSongs() {
    allSongsList.innerHTML = "";
    songs.forEach((song, index) => {
        const li = document.createElement("li");
        li.dataset.index = index;
        li.classList.add('list-group-item', 'playlist-item'); // Apply common styling
        li.innerHTML = `
            <img src="${song.img}" alt="Cover">
            <span>${song.title}</span>
            <button class="btn btn-sm btn-outline-primary add-to-playlist-btn" data-song-index="${index}">Add</button>
        `;
        li.addEventListener("click", (e) => {
            // Prevent button click from triggering song play on the li
            if (!e.target.classList.contains('add-to-playlist-btn')) {
                // When clicking a song in "All Songs" view, set currentPlaybackList to all songs
                currentPlaybackList = Array.from(Array(songs.length).keys());
                updateShuffleMode(); // Re-apply shuffle logic for all songs
                loadSong(index);
                playSong();
            }
        });
        allSongsList.appendChild(li);
    });
    updateActiveSongInLists();
    attachAddToPlaylistListeners(); // Attach event listeners after elements are added
}

// Update highlight for the currently playing song in both song lists
function updateActiveSongInLists() {
    // Update "All Songs" frame
    const allSongItems = allSongsList.querySelectorAll(".list-group-item");
    allSongItems.forEach((item) => {
        if (parseInt(item.dataset.index) === currentIndex) {
            item.classList.add("active");
            item.scrollIntoView({ behavior: "smooth", block: "nearest" });
        } else {
            item.classList.remove("active");
        }
    });

    // Update "Current Playlist Songs" if a playlist is active
    if (activePlaylistId !== null) {
        const currentPlaylistSongItems = currentPlaylistSongs.querySelectorAll(".list-group-item");
        currentPlaylistSongItems.forEach(item => {
            if (parseInt(item.dataset.index) === currentIndex) {
                item.classList.add("active");
                item.scrollIntoView({ behavior: "smooth", block: "nearest" });
            } else {
                item.classList.remove("active");
            }
        });
    }
}

// Render the list of user-defined playlists in the "Playlists" frame
function renderPlaylists() {
    playlistList.innerHTML = "";
    if (userPlaylists.length === 0) {
        playlistList.innerHTML = `<p class="text-center text-muted mt-3">No playlists yet. Create one!</p>`;
        return;
    }
    userPlaylists.forEach(playlist => {
        const li = document.createElement("li");
        li.dataset.playlistId = playlist.id;
        li.classList.add('list-group-item', 'playlist-item'); // Reuse styling classes
        li.innerHTML = `
            <span>${playlist.name} (${playlist.songs.length} songs)</span>
            <div class="playlist-actions">
                <button class="btn btn-sm btn-outline-info edit-playlist-btn" data-playlist-id="${playlist.id}">Edit</button>
                <button class="btn btn-sm btn-outline-danger delete-playlist-btn" data-playlist-id="${playlist.id}">Delete</button>
            </div>
        `;
        li.addEventListener('click', (e) => {
            // Only view playlist if not clicking on action buttons
            if (!e.target.classList.contains('edit-playlist-btn') && !e.target.classList.contains('delete-playlist-btn')) {
                viewPlaylist(playlist.id);
            }
        });
        playlistList.appendChild(li);
    });
    attachPlaylistActionListeners(); // Attach listeners for edit/delete buttons
}

// View a specific playlist's songs
function viewPlaylist(playlistId) {
    const playlist = userPlaylists.find(p => p.id === playlistId);
    if (!playlist) return;

    activePlaylistId = playlistId;
    playlistTitleDisplay.textContent = playlist.name; // Update title to playlist name
    backToPlaylistsBtn.classList.remove('d-none'); // Show back button
    createPlaylistBtn.classList.add('d-none'); // Hide create button when viewing a playlist
    playlistList.classList.add('d-none'); // Hide main playlist list
    currentPlaylistSongs.classList.remove('d-none'); // Show songs in current playlist

    // When viewing a specific playlist, set currentPlaybackList to its songs
    currentPlaybackList = Array.from(playlist.songs); // Create a copy of the array
    updateShuffleMode(); // Re-shuffle/unshuffle based on the new currentPlaybackList

    currentPlaylistSongs.innerHTML = "";
    if (playlist.songs.length === 0) {
        currentPlaylistSongs.innerHTML = `<p class="text-center text-muted mt-3">This playlist is empty. Add some songs from the 'Songs' tab!</p>`;
    } else {
        playlist.songs.forEach(songIndex => {
            const song = songs[songIndex]; // Get song details from the global `songs` array
            if (song) { // Ensure song still exists in the main song data
                const li = document.createElement("li");
                li.dataset.index = songIndex; // Store original song index
                li.classList.add('list-group-item', 'playlist-item');
                li.innerHTML = `
                    <img src="${song.img}" alt="Cover">
                    <span>${song.title}</span>
                    <button class="btn btn-sm btn-outline-danger remove-from-playlist-btn" data-playlist-id="${playlistId}" data-song-index="${songIndex}">Remove</button>
                `;
                li.addEventListener('click', (e) => {
                    if (!e.target.classList.contains('remove-from-playlist-btn')) {
                        // When clicking a song in a playlist view, the currentPlaybackList is already set to this playlist's songs
                        loadSong(songIndex); // Load and play song from this playlist
                        playSong();
                    }
                });
                currentPlaylistSongs.appendChild(li);
            }
        });
    }
    updateActiveSongInLists(); // Highlight currently playing song in this list too
    attachRemoveFromPlaylistListeners(); // Attach listeners for remove button
}

// Back to main playlists view
backToPlaylistsBtn.addEventListener('click', () => {
    activePlaylistId = null;
    playlistTitleDisplay.textContent = "Playlists"; // Revert title to "Playlists"
    backToPlaylistsBtn.classList.add('d-none');
    createPlaylistBtn.classList.remove('d-none');
    playlistList.classList.remove('d-none'); // Show main playlist list
    currentPlaylistSongs.classList.add('d-none'); // Hide songs in current playlist

    // When going back to main playlists view, revert currentPlaybackList to all songs
    currentPlaybackList = Array.from(Array(songs.length).keys());
    updateShuffleMode(); // Re-shuffle/unshuffle based on all songs
    renderPlaylists(); // Re-render the main playlist list to reflect any changes
});

// Create new playlist
createPlaylistBtn.addEventListener('click', () => {
    const playlistName = prompt("Enter new playlist name:");
    if (playlistName && playlistName.trim() !== "") {
        const newPlaylist = {
            id: Date.now().toString(), // Simple unique ID (timestamp)
            name: playlistName.trim(),
            songs: []
        };
        userPlaylists.push(newPlaylist);
        savePlaylists();
        renderPlaylists();
        alert(`Playlist "${playlistName.trim()}" created!`);
    } else if (playlistName !== null) { // If prompt was not cancelled but name was empty
        alert("Playlist name cannot be empty.");
    }
});

// Attach listeners for Add/Edit/Delete/Remove buttons (delegated or direct)
function attachAddToPlaylistListeners() {
    document.querySelectorAll('.add-to-playlist-btn').forEach(button => {
        button.onclick = (e) => {
            e.stopPropagation(); // Prevent li click
            const songIndex = parseInt(e.target.dataset.songIndex);
            promptAddToPlaylist(songIndex);
        };
    });
}

function attachPlaylistActionListeners() {
    document.querySelectorAll('.edit-playlist-btn').forEach(button => {
        button.onclick = (e) => {
            e.stopPropagation(); // Prevent li click
            const playlistId = e.target.dataset.playlistId;
            editPlaylistName(playlistId);
        };
    });

    document.querySelectorAll('.delete-playlist-btn').forEach(button => {
        button.onclick = (e) => {
            e.stopPropagation(); // Prevent li click
            const playlistId = e.target.dataset.playlistId;
            deletePlaylist(playlistId);
        };
    });
}

function attachRemoveFromPlaylistListeners() {
    document.querySelectorAll('.remove-from-playlist-btn').forEach(button => {
        button.onclick = (e) => {
            e.stopPropagation(); // Prevent li click
            const playlistId = e.target.dataset.playlistId;
            const songIndex = parseInt(e.target.dataset.songIndex);
            removeSongFromPlaylist(playlistId, songIndex);
        };
    });
}

// Logic for adding a song to a selected playlist
function promptAddToPlaylist(songIndex) {
    if (userPlaylists.length === 0) {
        alert("Chưa có playlist nào. Vui lòng tạo một playlist mới từ tab 'Playlists'.");
        return;
    }

    let playlistOptions = userPlaylists.map((p, idx) => `${idx + 1}. ${p.name}`).join("\n");
    let choice = prompt(`Thêm bài hát vào playlist nào?\n${playlistOptions}\nNhập số:`);

    if (choice) {
        let chosenIndex = parseInt(choice) - 1;
        if (chosenIndex >= 0 && chosenIndex < userPlaylists.length) {
            const playlist = userPlaylists[chosenIndex];
            if (!playlist.songs.includes(songIndex)) {
                playlist.songs.push(songIndex);
                savePlaylists();
                alert(`Bài hát đã được thêm vào "${playlist.name}".`);
                // If the target playlist is currently being viewed, re-render it
                if (activePlaylistId === playlist.id) {
                    viewPlaylist(playlist.id);
                }
            } else {
                alert(`Bài hát đã có trong "${playlist.name}".`);
            }
        } else {
            alert("Số playlist không hợp lệ.");
        }
    }
}

// Logic for editing playlist name
function editPlaylistName(playlistId) {
    const playlist = userPlaylists.find(p => p.id === playlistId);
    if (playlist) {
        const newName = prompt(`Đổi tên playlist "${playlist.name}":`, playlist.name);
        if (newName && newName.trim() !== "") {
            playlist.name = newName.trim();
            savePlaylists();
            renderPlaylists(); // Re-render main playlist list
            if (activePlaylistId === playlistId) { // Update title if currently viewing
                playlistTitleDisplay.textContent = newName.trim();
            }
            alert(`Playlist đã đổi tên thành "${newName.trim()}".`);
        } else if (newName !== null) {
            alert("Tên playlist không được để trống.");
        }
    }
}

// Logic for deleting a playlist
function deletePlaylist(playlistId) {
    if (confirm("Bạn có chắc chắn muốn xóa playlist này không? Thao tác này không thể hoàn tác.")) {
        userPlaylists = userPlaylists.filter(p => p.id !== playlistId);
        savePlaylists();
        renderPlaylists(); // Re-render main playlist list
        if (activePlaylistId === playlistId) { // If deleting the currently viewed playlist
            backToPlaylistsBtn.click(); // Go back to the main playlist list view
        }
        alert("Playlist đã được xóa.");
    }
}

// Logic for removing a song from a specific playlist
function removeSongFromPlaylist(playlistId, songIndex) {
    const playlist = userPlaylists.find(p => p.id === playlistId);
    if (playlist) {
        playlist.songs = playlist.songs.filter(sIndex => sIndex !== songIndex);
        savePlaylists();
        // If the playlist being modified is the one currently viewed, re-render it
        if (activePlaylistId === playlistId) {
            viewPlaylist(playlistId);
            // Additionally, if the removed song was the current playing song AND it's no longer in the currentPlaybackList,
            // we should stop playback or move to the next valid song. This is an advanced edge case,
            // for now, it will just show the song info but won't play if it's truly gone.
        }
        alert("Bài hát đã được xóa khỏi playlist.");
    }
}

// Save playlists to localStorage
function savePlaylists() {
    localStorage.setItem('userPlaylists', JSON.stringify(userPlaylists));
}

// --- Initial DOM Content Loaded ---
document.addEventListener("DOMContentLoaded", () => {
    initializePlayer();
    // Ensure initial display text for speed and timer
    playbackSpeedDisplay.textContent = "1x (Normal)";
    sleepTimerDisplay.textContent = "Hẹn giờ";

    // Set initial dark/light mode based on system preference
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) {
        htmlElement.classList.add("light-mode");
    } else {
        htmlElement.classList.remove("light-mode");
    }
    updateToggleButtonAppearance(); // Update button text immediately
});