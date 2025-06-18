const audio = new Audio(); // Tạo đối tượng Audio mới
audio.crossOrigin = "anonymous"; // Rất quan trọng cho Web Audio API khi tải từ nguồn khác hoặc trên server

const playPauseBtn = document.getElementById("play-pause");
const progressBar = document.getElementById("progress");
const volumeBar = document.getElementById("volume");
const currentSongDisplay = document.getElementById("current-song");
const toggleModeBtn = document.getElementById("toggle-mode");
const currentTimeEl = document.getElementById("current-time");
const durationEl = document.getElementById("duration"); // Sẽ hiển thị thời gian còn lại
const songImg = document.getElementById("song-img");
const htmlElement = document.documentElement;
const playlistElement = document.getElementById("playlist"); // Container của playlist (UL)
const shuffleBtn = document.getElementById("shuffle");
const repeatBtn = document.getElementById("repeat");
const prevBtn = document.getElementById("prev");
const nextBtn = document.getElementById("next");
const rewindBtn = document.getElementById("rewind-10");
const forwardBtn = document.getElementById("forward-10");
const playbackSpeedDropdown = document.getElementById("playbackSpeedDropdown");
const playbackSpeedItems = document.querySelectorAll(".playback-speed-item");
const sleepTimerDropdown = document.getElementById("sleepTimerDropdown");
const sleepTimerItems = document.querySelectorAll(".sleep-timer-item");
let sleepTimerTimeout = null; // To store the timeout ID
const visualizerCanvas = document.getElementById("visualizer");
const playbackSpeedDisplay =
  playbackSpeedDropdown.querySelector(".speed-display");
const sleepTimerDisplay = sleepTimerDropdown.querySelector(".timer-display");
const canvasCtx = visualizerCanvas.getContext("2d");
let analyser;
let audioCtx;
let source; // Biến source sẽ được khởi tạo trong setupWebAudio

const songs = [
  {
    path: "music/[ 킹스레이드 ] OST - -Not A Hero- (ENG ver.).mp3",
    title: "[ 킹스레이드 ] OST - -Not A Hero- (ENG ver.)",
    img: "img/not-a-hero.jpg",
  },
  {
    path: "music/[KING's RAID] CH.10 Title Song -The Right- - - Rebellion.mp3",
    title: "[KING's RAID] CH.10 Title Song -The Right- - - Rebellion",
    img: "img/the-right.jpg",
  },
  {
    path: "music/[MV] Deja Vu (Japanese Ver.) - KING's RAID X Dreamcatcher MV (Moving Illustration).mp3",
    title: "[MV] Deja Vu (Japanese Ver.) - KING's RAID X Dreamcatcher",
    img: "img/deja-vu.jpg",
  },
  {
    path: "music/Bakar - Hell N Back (Official Video).mp3",
    title: "Bakar - Hell N Back (Official Video)",
    img: "img/hell-n-back.jpg",
  },
  {
    path: "music/Genshin Impact - Liyue OST Relaxing Mix.mp3",
    title: "Genshin Impact - Liyue OST Relaxing Mix",
    img: "img/liyue-ost.jpg",
  },
  {
    path: "music/Operation Blade.mp3",
    title: "Operation Blade",
    img: "img/operation-blade.jpg",
  },
  {
    path: "music/Operation Lead Seal.mp3",
    title: "Operation Lead Seal",
    img: "img/operation-lead-seal.jpg",
  },
  {
    path: "music/With Glory I Shall Fall.mp3",
    title: "With Glory I Shall Fall",
    img: "img/with-glory-i-shall-fall.jpg",
  },
  {
    path: "music/ウォルピスカーター MV 泥中に咲く.mp3",
    title: "ウォルピスカーター MV 泥中に咲く",
    img: "img/blooming-in-the-mud.jpg",
  },
  {
    path: "music/オリジナルPV 小さな恋のうた  MONGOL800(cover) by天月.mp3",
    title: "オリジナルPV 小さな恋のうた MONGOL800(cover) by天月",
    img: "img/little-love-song.jpg",
  },
];

let currentIndex = 0;
let isPlaying = false;
let isShuffleOn = false; // Trạng thái trộn bài
let repeatMode = 0; // 0: No repeat, 1: Repeat all, 2: Repeat one
let shuffledIndexes = []; // Mảng chứa các index đã trộn theo thứ tự shuffle
let originalIndexes = Array.from(Array(songs.length).keys()); // Mảng thứ tự gốc [0, 1, ..., n-1]

// Khởi tạo trạng thái ban đầu
function initializePlayer() {
  loadPlaylist(); // Tải và hiển thị playlist
  loadSong(currentIndex); // Tải bài hát đầu tiên
  pauseSong();
  updateToggleButtonAppearance();
  audio.volume = volumeBar.value / 100;
  updateProgressBarFill(volumeBar, volumeBar.value);
  updateRepeatButtonAppearance();
}

// Tải bài hát và cập nhật UI (không tự động phát)
function loadSong(songIndex) {
  currentIndex = songIndex;
  const song = songs[currentIndex];
  audio.src = encodeURI(song.path);
  currentSongDisplay.textContent = song.title;
  songImg.src = song.img;

  updatePlaylistActive();

  // Reset progress bar và thời gian hiển thị
  progressBar.value = 0;
  updateProgressBarFill(progressBar, 0); // Đặt lại màu thanh tiến trình
  currentTimeEl.textContent = "0:00";
  durationEl.textContent = "-0:00"; // Đặt lại thời gian còn lại
}

// Phát nhạc
function playSong() {
  // Chỉ tải lại bài hát nếu nó chưa được tải hoặc là bài khác
  if (
    audio.src === "" ||
    !audio.src.includes(encodeURI(songs[currentIndex].path))
  ) {
    loadSong(currentIndex); // Tải bài hát
  }

  // Khởi tạo Web Audio API khi người dùng tương tác lần đầu
  if (!audioCtx) {
    setupWebAudio();
  } else if (audioCtx.state === "suspended") {
    // Đảm bảo AudioContext hoạt động trở lại nếu bị tạm dừng
    audioCtx
      .resume()
      .then(() => {
        console.log("AudioContext resumed successfully.");
      })
      .catch((err) => {
        console.error("Failed to resume AudioContext:", err);
      });
  }

  audio
    .play()
    .then(() => {
      playPauseBtn.classList.add("playing"); // Thêm class 'playing' để đổi icon
      isPlaying = true;
      startVisualizer();
    })
    .catch((err) => {
      console.error("Failed to play audio:", err);
      // Thông báo cho người dùng biết cần tương tác để phát nhạc
      alert(
        "Không thể phát nhạc. Vui lòng bấm nút Play/Pause hoặc chọn bài hát từ playlist."
      );
    });
}

// Dừng nhạc
function pauseSong() {
  audio.pause();
  playPauseBtn.classList.remove("playing"); // Xóa class 'playing'
  isPlaying = false;
  stopVisualizer();
}

// Chuyển đổi trạng thái phát/dừng
playPauseBtn.addEventListener("click", () => {
  isPlaying ? pauseSong() : playSong();
});

// Load playlist
function loadPlaylist() {
  playlistElement.innerHTML = ""; // Xóa các item cũ
  songs.forEach((song, index) => {
    const li = document.createElement("li");
    li.dataset.index = index;
    li.innerHTML = `
            <img src="${song.img}" alt="Cover">
            <span>${song.title}</span>
        `; // Bỏ artist nếu không có trong data
    li.addEventListener("click", () => {
      loadSong(index); // Tải bài hát được chọn
      playSong(); // Tự động phát khi chọn
    });
    playlistElement.appendChild(li);
  });
  updatePlaylistActive();
}

// Cập nhật highlight bài hát đang phát trong playlist
function updatePlaylistActive() {
  const listItems = playlistElement.querySelectorAll("li");
  listItems.forEach((item, index) => {
    if (index === currentIndex) {
      item.classList.add("active");
      item.scrollIntoView({ behavior: "smooth", block: "nearest" }); // Cuộn tới item đang active
    } else {
      item.classList.remove("active");
    }
  });
}

// Hàm để trộn thứ tự bài hát (Fisher-Yates shuffle)
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

// Chuyển bài hát tiếp theo
nextBtn.addEventListener("click", () => {
  if (isShuffleOn) {
    let currentShuffledIndex = shuffledIndexes.indexOf(currentIndex);
    let nextShuffledIndex = (currentShuffledIndex + 1) % shuffledIndexes.length;
    currentIndex = shuffledIndexes[nextShuffledIndex];
  } else {
    currentIndex = (currentIndex + 1) % songs.length;
  }
  loadSong(currentIndex);
  playSong(); // Luôn phát bài tiếp theo
});

// Chuyển bài hát trước đó
prevBtn.addEventListener("click", () => {
  if (isShuffleOn) {
    let currentShuffledIndex = shuffledIndexes.indexOf(currentIndex);
    let prevShuffledIndex =
      (currentShuffledIndex - 1 + shuffledIndexes.length) %
      shuffledIndexes.length;
    currentIndex = shuffledIndexes[prevShuffledIndex];
  } else {
    currentIndex = (currentIndex - 1 + songs.length) % songs.length;
  }
  loadSong(currentIndex);
  playSong(); // Luôn phát bài trước đó
});

// Điều chỉnh âm lượng
volumeBar.addEventListener("input", () => {
  audio.volume = volumeBar.value / 100; // input range min=0, max=1, step=0.01
  updateProgressBarFill(volumeBar, volumeBar.value); // Chuyển đổi sang % cho CSS variable
});

// Cập nhật thời gian hiện tại và tổng thời gian / thời gian còn lại
function formatTime(sec) {
  if (isNaN(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? "0" + s : s}`;
}

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

// Khi bài hát kết thúc
audio.addEventListener("ended", () => {
  if (repeatMode === 2) {
    // Repeat one
    playSong(); // Phát lại bài hiện tại (audio.currentTime sẽ tự động reset về 0)
  } else if (repeatMode === 1) {
    // Repeat all
    playNextSongLogic(); // Chuyển đến bài tiếp theo theo logic shuffle/normal
  } else {
    // No repeat
    if (
      isShuffleOn &&
      shuffledIndexes.indexOf(currentIndex) === shuffledIndexes.length - 1
    ) {
      // Hết list shuffle, dừng
      pauseSong();
      currentIndex = shuffledIndexes[0]; // Reset về bài đầu tiên của list shuffle
      loadSong(currentIndex);
    } else if (!isShuffleOn && currentIndex === songs.length - 1) {
      // Hết list bình thường, dừng
      pauseSong();
      currentIndex = 0; // Reset về bài đầu tiên của list gốc
      loadSong(currentIndex);
    } else {
      // Vẫn còn bài hát tiếp theo trong list
      playNextSongLogic();
    }
  }
});

function playNextSongLogic() {
  if (isShuffleOn) {
    let currentShuffledIndex = shuffledIndexes.indexOf(currentIndex);
    let nextShuffledIndex = (currentShuffledIndex + 1) % shuffledIndexes.length;
    if (nextShuffledIndex === 0 && repeatMode !== 1) {
      // Nếu hết list shuffle và không lặp lại tất cả
      pauseSong();
      currentIndex = shuffledIndexes[0]; // Reset về bài đầu tiên của list shuffle
      loadSong(currentIndex);
      return;
    }
    currentIndex = shuffledIndexes[nextShuffledIndex];
  } else {
    currentIndex = (currentIndex + 1) % songs.length;
    if (currentIndex === 0 && repeatMode !== 1) {
      // Nếu hết list gốc và không lặp lại tất cả
      pauseSong();
      currentIndex = 0; // Reset về bài đầu tiên của list gốc
      loadSong(currentIndex);
      return;
    }
  }
  loadSong(currentIndex);
  playSong();
}

// Tua bài hát
progressBar.addEventListener("input", () => {
  if (!isNaN(audio.duration) && audio.duration > 0) {
    const newTime = (progressBar.value / 100) * audio.duration;
    audio.currentTime = newTime;
    updateProgressBarFill(progressBar, progressBar.value); // Cập nhật màu khi tua
  }
});

// Hàm cập nhật màu cho thanh tiến trình và âm lượng
function updateProgressBarFill(inputElement, percent) {
  inputElement.style.setProperty("--progress-percent", `${percent}%`);
}

// Dark-Light Mode
function updateToggleButtonAppearance() {
  const isLightMode = htmlElement.classList.contains("light-mode");
  toggleModeBtn.innerHTML = isLightMode ? "🌙 Dark Mode" : "☀️ Light Mode";
}

toggleModeBtn.addEventListener("click", () => {
  htmlElement.classList.toggle("light-mode");
  updateToggleButtonAppearance();
  updateProgressBarFill(progressBar, progressBar.value); // Cập nhật lại màu cho thanh
  updateProgressBarFill(volumeBar, volumeBar.value * 100); // Cập nhật lại màu cho thanh
});

// Logic cho nút Shuffle
shuffleBtn.addEventListener("click", () => {
  isShuffleOn = !isShuffleOn;
  shuffleBtn.classList.toggle("active", isShuffleOn); // Thêm/bỏ class 'active' cho nút

  if (isShuffleOn) {
    shuffledIndexes = Array.from(originalIndexes); // Bắt đầu từ thứ tự gốc
    // Loại bỏ bài hiện tại ra khỏi phần để shuffle, sau đó shuffle phần còn lại và đặt bài hiện tại lên đầu
    const currentSongOriginalIndex = originalIndexes.indexOf(currentIndex);
    if (currentSongOriginalIndex > -1) {
      // Đảm bảo bài hát hiện tại tồn tại trong danh sách
      shuffledIndexes.splice(currentSongOriginalIndex, 1); // Loại bỏ bài hiện tại
    }
    shuffleArray(shuffledIndexes); // Trộn phần còn lại
    shuffledIndexes.unshift(currentIndex); // Đặt bài hiện tại lên đầu danh sách trộn
  } else {
    // Khi tắt shuffle, quay về thứ tự gốc
    currentIndex = originalIndexes[originalIndexes.indexOf(currentIndex)]; // Đảm bảo currentIndex vẫn đúng vị trí trong list gốc
  }
  updatePlaylistActive(); // Cập nhật highlight sau khi thay đổi currentIndex/shuffled list
});

// Logic cho nút Repeat
function updateRepeatButtonAppearance() {
  repeatBtn.classList.remove("active", "repeat-one");
  if (repeatMode === 1) {
    repeatBtn.classList.add("active"); // Active cho Repeat All
  } else if (repeatMode === 2) {
    repeatBtn.classList.add("active", "repeat-one"); // Active và thêm class cho Repeat One
  }
  // Nếu repeatMode là 0 (none) thì không thêm class nào
}

repeatBtn.addEventListener("click", () => {
  repeatMode = (repeatMode + 1) % 3; // Chuyển đổi 0 -> 1 -> 2 -> 0
  updateRepeatButtonAppearance();
});

// --- NEW FEATURES LOGIC ---

// 1. Tua Nhanh & Tua Lại (Seek Forward/Backward)
rewindBtn.addEventListener("click", () => {
  audio.currentTime = Math.max(0, audio.currentTime - 10); // Tua lại 10 giây, không nhỏ hơn 0
});

forwardBtn.addEventListener("click", () => {
  audio.currentTime = Math.min(audio.duration, audio.currentTime + 10); // Tua nhanh 10 giây, không lớn hơn tổng thời lượng
});

// 2. Chỉnh Tốc Độ Phát (Playback Speed)
playbackSpeedItems.forEach((item) => {
  item.addEventListener("click", (e) => {
    e.preventDefault(); // Ngăn hành vi mặc định của link
    const speed = parseFloat(item.dataset.speed);
    audio.playbackRate = speed;
    // Cập nhật text hiển thị trên nút dropdown
    playbackSpeedDisplay.textContent = `${speed}x Speed`;
    // Thêm logic để hiển thị "Normal" nếu tốc độ là 1
    if (speed === 1) {
      playbackSpeedDisplay.textContent = "1x (Normal)";
    }
  });
});

// 3. Hiệu ứng Visualizer (Thanh sóng nhạc động)
function setupWebAudio() {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();

    if (!source) {
        source = audioCtx.createMediaElementSource(audio);
        source.connect(analyser);
        analyser.connect(audioCtx.destination);
    }

    analyser.fftSize = 256; // Tùy chỉnh để có nhiều thanh hơn hoặc ít hơn
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    // Lấy kích thước canvas từ thuộc tính HTML
    const canvasWidth = visualizerCanvas.width;
    const canvasHeight = visualizerCanvas.height;

    // Gradient màu sắc cho visualizer
    // Tạo gradient theo chiều dọc của canvas
    const gradient = canvasCtx.createLinearGradient(0, 0, 0, canvasHeight);
    gradient.addColorStop(0, '#ff0000'); // Top: Red
    gradient.addColorStop(0.25, '#ff8c00'); // Orange
    gradient.addColorStop(0.5, '#ffff00'); // Yellow
    gradient.addColorStop(0.75, '#00ff40'); // Green
    gradient.addColorStop(1, '#00f7ff'); // Bottom: Aqua

    function draw() {
        requestAnimationFrame(draw);

        if (isPlaying) {
            analyser.getByteFrequencyData(dataArray);
            canvasCtx.clearRect(0, 0, canvasWidth, canvasHeight);

            const barSpacing = 2; // Khoảng cách giữa các thanh
            const barWidth = 4; // Chiều rộng cố định của mỗi thanh
            const numBars = bufferLength; // Số lượng thanh sẽ vẽ
            
            // Tính toán vị trí tâm ngang của canvas để vẽ từ giữa ra
            const midHeight = canvasHeight / 2;

            for (let i = 0; i < numBars; i++) {
                // Giá trị tần số (độ lớn của sóng)
                // Normalize dataArray[i] (0-255) to a height relative to midHeight
                // Scale it so that even low values are visible, but high values reach closer to edges
                let barAmplitude = dataArray[i]; // Value from 0-255
                
                // Scale amplitude to fit visualizer height
                // Max height of a bar from center is midHeight - some padding
                // Example: make 255 map to 90% of midHeight
                let barLength = (barAmplitude / 255) * (midHeight * 0.9);

                // Màu sắc: Sử dụng gradient đã tạo
                canvasCtx.fillStyle = gradient;

                // X position for the current bar
                const x = i * (barWidth + barSpacing);
                
                // Don't draw if it goes off canvas horizontally (important for small visualizer width)
                if (x + barWidth > canvasWidth) {
                    break; 
                }

                // Draw the top half of the bar (extending upwards from the center)
                canvasCtx.fillRect(
                    x,                          // X start position
                    midHeight - barLength,      // Y start position (moves upwards)
                    barWidth,                   // Width of the bar
                    barLength                   // Height of the bar (towards center)
                );

                // Draw the bottom half of the bar (extending downwards from the center)
                canvasCtx.fillRect(
                    x,                          // X start position
                    midHeight,                  // Y start position (from center)
                    barWidth,                   // Width of the bar
                    barLength                   // Height of the bar (towards bottom)
                );
            }
        } else {
            // Khi dừng, xóa canvas
            canvasCtx.clearRect(0, 0, canvasWidth, canvasHeight);
        }
    }

    draw(); // Bắt đầu vòng lặp vẽ
}

function startVisualizer() {
  // Logic vẽ sẽ tự động chạy trong draw() nếu isPlaying = true
  // Không cần gọi resume() ở đây vì đã gọi trong playSong()
}

function stopVisualizer() {
  // Logic vẽ sẽ tự dừng khi isPlaying = false
}

// 4. Chế độ Hẹn Giờ Tắt Nhạc (Sleep Timer)
sleepTimerItems.forEach((item) => {
  item.addEventListener("click", (e) => {
    e.preventDefault();
    const minutes = parseInt(item.dataset.minutes);

    // Xóa hẹn giờ cũ nếu có
    if (sleepTimerTimeout) {
      clearTimeout(sleepTimerTimeout);
      sleepTimerTimeout = null;
      alert("Đã hủy hẹn giờ tắt nhạc.");
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
      sleepTimerDisplay.textContent = `Hẹn giờ (${minutes}p)`; // Cập nhật text
    } else {
      // Xử lý trường hợp "Tắt hẹn giờ" (minutes = 0)
      alert("Hẹn giờ tắt nhạc đã được hủy.");
      sleepTimerDisplay.textContent = "Hẹn giờ"; // Reset text
    }
  });
});

// Gọi hàm khởi tạo khi trang tải xong
document.addEventListener("DOMContentLoaded", () => {
  initializePlayer(); // Hàm này đã được gọi
  // Đảm bảo text ban đầu cho tốc độ và hẹn giờ
  playbackSpeedDisplay.textContent = "1x (Normal)";
  sleepTimerDisplay.textContent = "Hẹn giờ";
});

// Đặt chế độ sáng/tối ban đầu dựa trên hệ thống
if (
  window.matchMedia &&
  window.matchMedia("(prefers-color-scheme: light)").matches
) {
  htmlElement.classList.add("light-mode");
} else {
  htmlElement.classList.remove("light-mode");
}
updateToggleButtonAppearance(); // Cập nhật hiển thị nút ngay lập tức
