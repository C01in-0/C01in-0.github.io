(() => {
  const article = document.querySelector('.colin-excerpts');
  if (!article) return;

  const tracks = article.querySelectorAll('audio');
  for (const audio of tracks) {
    const heading = audio.closest('section').querySelector('h2');
    if (heading.querySelector('.excerpt-play')) continue;

    const title = audio.getAttribute('aria-label');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'excerpt-play';
    const label = document.createElement('span');
    label.textContent = title;
    button.append(label);
    const setPlaying = playing => {
      button.setAttribute('aria-pressed', String(playing));
      button.setAttribute('aria-label', (playing ? '暂停' : '播放') + title);
      button.title = button.getAttribute('aria-label');
    };
    setPlaying(false);
    heading.append(button);

    const status = document.createElement('small');
    status.setAttribute('role', 'status');
    audio.after(status);
    audio.addEventListener('playing', () => setPlaying(true));
    audio.addEventListener('pause', () => setPlaying(false));
    audio.addEventListener('ended', () => setPlaying(false));
    button.addEventListener('click', async () => {
      if (!audio.paused) {
        audio.pause();
        return;
      }
      for (const other of tracks) {
        if (other !== audio) other.pause();
      }
      status.textContent = '';
      try {
        await audio.play();
      } catch (error) {
        if (error.name !== 'AbortError') status.textContent = '音频未能播放，请再试一次。';
        setPlaying(!audio.paused);
      }
    });
  }
})();
