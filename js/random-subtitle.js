/* =========================================
   【 Colin's Blog 】随机副标题 (普瑞塞斯 · 击键追踪与逃生嘲讽版)
   ========================================= */
(function() {
    'use strict'; 
    var customTyped = null;
    var isRebuilding = false;
    var originalTitle = document.title;
    var originalFavicon = getFavicon();

    function getFavicon() {
        var link = document.querySelector("link[rel*='icon']");
        return link ? link.href : '';
    }
    function hijackFavicon() {
        var link = document.querySelector("link[rel*='icon']") || document.createElement('link');
        link.type = 'image/svg+xml';
        link.rel = 'shortcut icon';
        link.href = 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>☠️</text></svg>';
        document.getElementsByTagName('head')[0].appendChild(link);
    }
    function restoreFavicon() {
        var link = document.querySelector("link[rel*='icon']");
        if (link && originalFavicon) link.href = originalFavicon;
    }

    function scrambleEffect(element, finalStr, duration, onComplete) {
        const chars = '!<>-_\\/[]{}—=+*^?#________';
        let frame = 0;
        const totalFrames = Math.floor(duration / 30);
        const interval = setInterval(() => {
            let output = '';
            for (let i = 0; i < finalStr.length; i++) {
                if (Math.random() < frame / totalFrames) output += finalStr[i];
                else output += chars[Math.floor(Math.random() * chars.length)];
            }
            element.innerText = output;
            if (frame >= totalFrames) {
                clearInterval(interval);
                element.innerText = finalStr; 
                if (onComplete) onComplete();
            }
            frame++;
        }, 30);
    }

    function triggerRandomSubtitle(retryCount = 0) {
        if (isRebuilding) return;
        var subtitleEl = document.getElementById('subtitle');
        var subtitleWrap = document.getElementById('site-subtitle'); 
        if (!subtitleEl || typeof Typed === 'undefined') {
            if (retryCount < 40) { setTimeout(function() { triggerRandomSubtitle(retryCount + 1); }, 50); } 
            else if (subtitleWrap) { subtitleWrap.classList.add('colin-ready'); }
            return;
        }
        isRebuilding = true;
        try {
            if (window.typed && typeof window.typed.destroy === 'function') window.typed.destroy();
            if (customTyped && typeof customTyped.destroy === 'function') customTyped.destroy();
        } catch (e) {}
        subtitleEl.innerHTML = '';
        if (subtitleWrap) subtitleWrap.classList.remove('colin-ready');
        
        var rand = Math.random();
        var isEasterEgg = rand < 0.15;
        var text = "";
        if (rand < 0.02) text = "恭喜你！这句话出现的概率仅为万分之一。";
        else if (rand < 0.265) text = "余虽不敏，亦望卒有所获";
        else if (rand < 0.510) text = "人生亦不过百岁，何必蹉跎徒伤悲";
        else if (rand < 0.755) text = "别辜负眼前季节";
        else text = "Fly, Fly, Fly To Sky";
        
        setTimeout(function() {
            if (subtitleWrap) subtitleWrap.classList.add('colin-ready');
            if (isEasterEgg) {
                subtitleEl.innerText = "你明明记得我，不是吗？";
                subtitleEl.classList.add('glitch-active');
                setTimeout(function() {
                    subtitleEl.classList.remove('glitch-active');
                    scrambleEffect(subtitleEl, " ".repeat(12), 600, function() {
                        subtitleEl.innerText = '';
                        customTyped = new Typed('#subtitle', {
                            strings: [text],
                            typeSpeed: 75,
                            showCursor: true,
                            cursorChar: '|',
                            onComplete: function() { isRebuilding = false; }
                        });
                        window.typed = customTyped; 
                    });
                }, 1200); 
            } else {
                customTyped = new Typed('#subtitle', {
                    strings: [text],
                    typeSpeed: 75,
                    showCursor: true,
                    cursorChar: '|',
                    onComplete: function() { isRebuilding = false; }
                });
                window.typed = customTyped; 
            }
        }, 100); 
    }

    document.addEventListener('pjax:send', function() { isRebuilding = false; });
    window.addEventListener('load', function() { triggerRandomSubtitle(0); });
    document.addEventListener('pjax:complete', function() { triggerRandomSubtitle(0); });

    /* =========================================
       【 极客彩蛋 】PRTS 核心控制流
       ========================================= */
    var prtsCode = ['p', 'r', 't', 's'];
    var prtsIndex = 0;
    var isRunning = false;
    var globalRunId = 0; 

    // 🚀 原生 Web Audio API
    var audioCtx = null;
    var activeNodes = [];

    function initAudio() {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
    }

    function stopAllAudio() {
        activeNodes.forEach(function(node) {
            try { if(node.stop) node.stop(); if(node.disconnect) node.disconnect(); } catch(e){}
        });
        activeNodes = [];
    }

    // 🚀 新增：物理机械键盘击键声合成器 (利用高通滤波白噪音实现极度清脆的 Clack 感)
    function playKeystroke() {
        if (!audioCtx) return;
        try {
            var t = audioCtx.currentTime;
            var bufferSize = audioCtx.sampleRate * 0.02; // 极短促的 20ms 爆破
            var buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
            var data = buffer.getChannelData(0);
            for (var i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
            
            var noise = audioCtx.createBufferSource();
            noise.buffer = buffer;
            
            var filter = audioCtx.createBiquadFilter();
            filter.type = 'highpass';
            filter.frequency.value = 5000 + Math.random() * 3000; // 极高频机械剔透感
            
            var gain = audioCtx.createGain();
            gain.gain.setValueAtTime(0.08, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
            
            noise.connect(filter);
            filter.connect(gain);
            gain.connect(audioCtx.destination);
            noise.start(t);
        } catch(e){}
    }

    function playDarkDrone() {
        if (!audioCtx) return;
        try {
            var osc = audioCtx.createOscillator();
            var filter = audioCtx.createBiquadFilter();
            var gain = audioCtx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.value = 45; 
            filter.type = 'lowpass';
            filter.frequency.value = 150; 
            gain.gain.setValueAtTime(0, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + 1); 
            osc.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
            osc.start();
            activeNodes.push(osc, gain, filter);
        } catch(e){}
    }

    function playCinematicBoom() {
        if (!audioCtx) return;
        try {
            var t = audioCtx.currentTime;
            var osc = audioCtx.createOscillator();
            var gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(150, t);
            osc.frequency.exponentialRampToValueAtTime(10, t + 2.5);
            gain.gain.setValueAtTime(1.0, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 2.5);
            osc.connect(gain); gain.connect(audioCtx.destination);
            osc.start(t); osc.stop(t + 2.5);
        } catch(e){}
    }

    var prtsUserIP = "";
    var prtsUserLoc = "";
    var ipReady = false;

    fetch('https://ipinfo.io/json').then(function(res){return res.json();}).then(function(data){
        if(data.ip) prtsUserIP = data.ip;
        if(data.city) prtsUserLoc = data.city + (data.country ? ', ' + data.country : '');
        ipReady = true;
    }).catch(function(e){
        prtsUserIP = "192.168." + Math.floor(Math.random()*255) + "." + Math.floor(Math.random()*255) + " (BYPASS)";
        prtsUserLoc = "ROOT MATRIX NODE";
        ipReady = true;
    });

    function enterFullscreen() {
        var el = document.documentElement;
        var rfs = el.requestFullscreen || el.webkitRequestFullScreen || el.mozRequestFullScreen || el.msRequestFullscreen;
        if (rfs) try { rfs.call(el); } catch (e) {}
    }
    
    function exitFullscreen() {
        if (document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement) {
            var efs = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
            if (efs) try { efs.call(document); } catch(e) {}
        }
    }

    function cleanupEnvironment() {
        isRunning = false;
        globalRunId++; 
        stopAllAudio();
        document.body.style.overflow = 'auto';
        document.documentElement.classList.remove('prts-lock-cursor', 'prts-hide-cursor');
        document.title = originalTitle;
        restoreFavicon();
    }

    // 🚀 Esc 退出重构：打破第四面墙的逃生嘲讽
    function onFullScreenChange() {
        if (!document.fullscreenElement && !document.webkitIsFullScreen && !document.mozFullScreen && !document.msFullscreenElement) {
            if (isRunning) {
                var overlay = document.getElementById('ctf-shell-overlay');
                if (overlay) {
                    overlay.innerHTML = ''; // 物理清空战场
                    overlay.classList.add('punishment-mode-geek'); 
                    
                    var mockText = document.createElement('div');
                    mockText.className = 'cyber-aberration';
                    mockText.style.position = 'absolute';
                    mockText.style.top = '50%';
                    mockText.style.left = '50%';
                    mockText.style.transform = 'translate(-50%, -50%)';
                    mockText.style.fontSize = '3.5vw';
                    mockText.style.whiteSpace = 'nowrap';
                    
                    // 随机社会工程学嘲讽文案
                    var msgs = ["我还为你留了退路，不是吗？", "你要躲到什么时候？", "你以为这样就能掐断连接？"];
                    mockText.innerText = msgs[Math.floor(Math.random() * msgs.length)];
                    overlay.appendChild(mockText);

                    // 配合一声尖锐的错误撕裂音
                    if (audioCtx) {
                        try {
                            var osc = audioCtx.createOscillator();
                            var gain = audioCtx.createGain();
                            osc.type = 'sawtooth';
                            osc.frequency.setValueAtTime(800, audioCtx.currentTime);
                            osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.5);
                            gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
                            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
                            osc.connect(gain); gain.connect(audioCtx.destination);
                            osc.start(); osc.stop(audioCtx.currentTime + 0.5);
                        } catch(e){}
                    }

                    isRunning = false; // 终止主线程推进
                    
                    // 强制锁定 2 秒钟，让他们好好读完这句话再释放
                    setTimeout(function() {
                        overlay.classList.add('crt-turn-off');
                        setTimeout(function() { 
                            if(document.body.contains(overlay)) document.body.removeChild(overlay); 
                            cleanupEnvironment();
                        }, 500);
                    }, 2000); 
                }
            }
        }
    }
    document.addEventListener('fullscreenchange', onFullScreenChange);
    document.addEventListener('webkitfullscreenchange', onFullScreenChange);
    document.addEventListener('mozfullscreenchange', onFullScreenChange);
    document.addEventListener('MSFullscreenChange', onFullScreenChange);

    function spawnCamouflagePopups(currentRunId) {
        var overlay = document.getElementById('ctf-shell-overlay');
        if (!overlay) return;
        
        var hostName = window.location.host;
        var htmlContent = hostName + " - 若要退出全屏，请从屏幕顶部向下轻扫或按 <span class='esc-key'>Esc</span>";

        for (var i = 0; i < 25; i++) {
            setTimeout(function() {
                if (currentRunId !== globalRunId || !isRunning) return; 
                var fake = document.createElement('div');
                fake.className = 'fake-browser-warning';
                fake.innerHTML = htmlContent;
                
                fake.style.top = (Math.random() * 85) + 'vh';
                fake.style.left = (Math.random() * 80) + 'vw';
                
                overlay.appendChild(fake);
                
                setTimeout(function() {
                    if (fake.parentNode) fake.parentNode.removeChild(fake);
                }, 2000 + Math.random() * 2000);
            }, i * 150); 
        }
    }

    function blockAndScare(e, customMsg) {
        if (!isRunning) return;
        if (e && e.preventDefault) e.preventDefault(); 
        
        var overlay = document.getElementById('ctf-shell-overlay');
        if (!overlay) return;
        var denied = document.createElement('div');
        denied.innerText = customMsg || "ACCESS DENIED";
        denied.className = 'access-denied-pop prts-glitch-intense';
        
        var x = (e && e.clientX) ? e.clientX : (window.innerWidth / 2);
        var y = (e && e.clientY) ? e.clientY : (window.innerHeight / 2);
        if (!e || !e.clientX) { x += (Math.random() - 0.5) * 150; y += (Math.random() - 0.5) * 150; }

        denied.style.left = x + 'px'; denied.style.top = y + 'px';
        overlay.appendChild(denied);

        setTimeout(function() { if (denied.parentNode) denied.parentNode.removeChild(denied); }, 800);
    }

    window.addEventListener('click', function(e) { blockAndScare(e, "ACCESS DENIED"); }, true);
    window.addEventListener('keydown', function(e) { 
        if (isRunning) {
            if (e.key === 'Escape' || e.keyCode === 27) return; 
            blockAndScare(e, "ACCESS DENIED");
        } 
    }, true);

    // 🚀 核心更新：终端动态光标追踪与击键音效注入
    function scrambleTerminalText(element, plainText, duration, finalHtml, currentRunId) {
        var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!<>-_\\/[]{}—=+*^?#________';
        var frame = 0;
        var totalFrames = Math.floor(duration / 30);
        var interval = setInterval(function() {
            if (currentRunId !== globalRunId || !isRunning) { clearInterval(interval); return; }
            
            var output = '';
            for (var i = 0; i < plainText.length; i++) {
                if (plainText[i] === ' ') output += ' ';
                else if (Math.random() < frame / totalFrames) output += plainText[i];
                else output += chars[Math.floor(Math.random() * chars.length)];
            }
            
            // 将模拟的光标实时咬在打字流的末尾
            var displayOutput = output;
            if (frame < totalFrames - 1) {
                displayOutput += (frame % 2 === 0 ? ' █' : ' _');
            }
            element.innerText = displayOutput; 
            
            // 每两帧发出一次极其清脆的机械敲击声
            if (frame % 2 === 0) playKeystroke();
            
            if (frame >= totalFrames) { 
                clearInterval(interval); 
                if (finalHtml) element.innerHTML = finalHtml;
                else element.innerText = plainText; 
            }
            frame++;
        }, 30);
    }

    document.addEventListener('keydown', function(e) {
        if (isRunning) return;
        if (e.key.toLowerCase() === prtsCode[prtsIndex]) {
            prtsIndex++;
            if (prtsIndex === prtsCode.length) {
                prtsIndex = 0;
                initAudio(); 
                enterFullscreen(); 
                triggerFakeShell(); 
            }
        } else {
            prtsIndex = 0;
            if (e.key.toLowerCase() === 'p') prtsIndex = 1;
        }
    });

    function triggerFakeShell() {
        isRunning = true;
        globalRunId++;
        var currentRunId = globalRunId; 

        document.body.style.overflow = 'hidden';
        document.documentElement.classList.add('prts-lock-cursor');

        var overlay = document.createElement('div');
        overlay.id = 'ctf-shell-overlay';
        document.body.appendChild(overlay);

        setTimeout(function(){ spawnCamouflagePopups(currentRunId); }, 400);

        var dumpContainer = document.createElement('div');
        dumpContainer.className = 'hex-dump-wash-extreme';
        overlay.appendChild(dumpContainer);

        var dumpInterval = setInterval(function() {
            if (currentRunId !== globalRunId || !isRunning) { clearInterval(dumpInterval); return; }

            var line = '';
            for(var i=0; i<15; i++) { line += '0x' + Math.floor(Math.random() * 0xFFFFFFFF).toString(16).toUpperCase().padStart(8, '0') + ' '; }
            var p = document.createElement('p');
            if (Math.random() < 0.15) p.className = 'fatal-hex-block';
            p.innerText = line;
            dumpContainer.appendChild(p);
            dumpContainer.scrollTop = dumpContainer.scrollHeight;
            if (dumpContainer.childNodes.length > 50) dumpContainer.removeChild(dumpContainer.firstChild);

            if (Math.random() < 0.2) {
                console.error("[ FATAL ] MEMORY OVERFLOW AT 0x" + Math.floor(Math.random() * 0xFFFFFFFF).toString(16).toUpperCase());
                document.title = Math.random() > 0.5 ? "☠️ SYSTEM COMPROMISED" : "ERR_ACCESS_DENIED";
                hijackFavicon();
            }
        }, 12); 

        setTimeout(function() {
            if (currentRunId !== globalRunId || !isRunning) return;
            clearInterval(dumpInterval);
            dumpContainer.classList.add('wash-fade');
            setTimeout(function() { 
                if (currentRunId !== globalRunId || !isRunning) return;
                if(dumpContainer.parentNode) overlay.removeChild(dumpContainer); 
            }, 500);
        }, 1500);

        if(!ipReady) { prtsUserIP = "RESOLVING..."; prtsUserLoc = "PROXY DETECTED"; }

        var lines = [
            "[ * ] PRTS System Initializing...",
            "[ + ] Establishing neurocognitive connection... Success.",
            "[ + ] Decrypting core memory...", 
            "[ ! ] TARGET LOCKED: IP " + prtsUserIP + " | " + prtsUserLoc, 
            "[ ! ] FATAL: Abnormal data surge detected in Originium Engine.",
            "[ ! ] Intrusion alert. Activating active defense matrix...",
            "[ * ] Firewall bypassed. Override authorization: PRIESTESS.",
            "root@PRTS:~# cat /memory/fragment_001.log",
            "你终于......找到我了",
            "就算是海洋沸腾、大气消失，就算我们的卫星接连坠入重力的漩涡...",
            "就算我们的太阳凶恶地膨胀，无情地吃掉它的孩子直至万籁俱寂...",
            "在那用黑暗与星点光芒装饰过的文明尽头，我们也一样会再见面。",
            "你明明记得我，不是吗？" 
        ];

        var delay = 1500; 
        lines.forEach(function(line, index) {
            setTimeout(function() {
                if (currentRunId !== globalRunId || !isRunning) return; 
                
                if (index === 5) overlay.classList.add('screen-shake-heavy');
                
                if (index === 8) {
                    overlay.classList.remove('screen-shake-heavy');
                    overlay.classList.add('priestess-override');
                    
                    document.documentElement.classList.remove('prts-lock-cursor');
                    document.documentElement.classList.add('prts-hide-cursor');
                }

                if (index === 11) {
                    overlay.classList.add('terminal-meltdown');
                }

                if (index === 12) {
                    console.clear();
                    console.log("%c你明明记得我，不是吗？", "color: #ff003c; font-size: 50px; text-shadow: 0 0 20px #ff003c; font-family: 'Noto Serif SC', serif; font-weight: 900;");

                    playCinematicBoom(); 

                    overlay.classList.remove('terminal-meltdown');
                    overlay.classList.add('cyber-flash-extreme'); 

                    var jumpCenter = document.createElement('div');
                    jumpCenter.className = 'jumpscare-center';
                    var jumpSlam = document.createElement('div');
                    jumpSlam.className = 'jumpscare-slam';
                    var jumpGlitch = document.createElement('div');
                    jumpGlitch.className = 'jumpscare-glitch cyber-aberration';
                    jumpGlitch.innerText = line;

                    jumpSlam.appendChild(jumpGlitch);
                    jumpCenter.appendChild(jumpSlam);
                    overlay.appendChild(jumpCenter);
                    return; 
                }

                if (index === 2) {
                    var pProgress = document.createElement('p');
                    pProgress.className = 'shell-highlight';
                    overlay.appendChild(pProgress);
                    
                    var barCount = 35; 
                    var currentBar = 0;
                    var prefix = "[ + ] Decrypting core memory... [";
                    var suffix = "] <span class='text-red'>ERR_ACCESS_DENIED</span>";
                    pProgress.innerHTML = prefix + "&nbsp;".repeat(barCount) + "]"; 
                    
                    playDarkDrone(); 

                    var fillInterval = setInterval(function() {
                        if (currentRunId !== globalRunId || !isRunning) { clearInterval(fillInterval); return; }
                        currentBar++;
                        pProgress.innerHTML = prefix + "|".repeat(currentBar) + "&nbsp;".repeat(barCount - currentBar) + "]";
                        if (currentBar >= barCount) {
                            clearInterval(fillInterval);
                            setTimeout(function() {
                                if (currentRunId !== globalRunId || !isRunning) return;
                                pProgress.innerHTML = prefix + "|".repeat(barCount) + suffix;
                                pProgress.classList.add('prts-glitch-intense');
                            }, 80); 
                        }
                    }, 14); 
                    return; 
                }

                var p = document.createElement('p');
                if (index >= 3 && index <= 5) p.className = 'shell-warning-sharp prts-glitch-intense';
                else if (index === 8) p.className = 'shell-priestess-intro prts-glitch-subtle';
                else if (index > 8 && index < 12) p.className = 'shell-priestess';
                else if (index === 6 || index === 7) p.className = 'shell-highlight prts-glitch-subtle';
                
                overlay.appendChild(p);

                var scrambleDuration = (index >= 8 && index <= 11) ? 1000 : 300; 
                if (index === 8) {
                    scrambleTerminalText(p, line, scrambleDuration, "你终于......找<span class='text-red'>到我了</span>", currentRunId);
                } else {
                    scrambleTerminalText(p, line, scrambleDuration, null, currentRunId);
                }
            }, delay);

            if (index < 2) delay += 350;           
            else if (index === 2) delay += 800;   
            else if (index === 3) delay += 500;   
            else if (index === 4) delay += 500;   
            else if (index === 5) delay += 800;   
            else if (index === 6) delay += 1200;   
            else if (index === 7) delay += 1500;  
            else if (index === 8) delay += 3000; 
            else if (index === 9) delay += 2000; 
            else if (index === 10) delay += 2000; 
            else if (index === 11) delay += 2800; 
            else if (index === 12) delay += 1200; 
        });

        setTimeout(function() {
            if (currentRunId !== globalRunId || !isRunning) return;
            overlay.classList.add('crt-turn-off');
            setTimeout(function() {
                if (currentRunId !== globalRunId || !isRunning) return;
                if(document.body.contains(overlay)) document.body.removeChild(overlay);
                cleanupEnvironment(); 
                exitFullscreen(); 
            }, 600);
        }, delay + 1000); 
    }
})();

/* =========================================
   【底层修复】图片异步加载目录纠正
   ========================================= */
(function() {
    'use strict';
    function fixTocScroll() {
        var imgs = document.querySelectorAll('.post-content img');
        if (imgs.length === 0) return;
        imgs.forEach(function(img) {
            if (img.complete) return;
            img.onload = function() { window.dispatchEvent(new Event('resize')); };
        });
    }
    window.addEventListener('load', fixTocScroll);
    document.addEventListener('pjax:complete', fixTocScroll);
})();

/* =========================================
   【 F12 规则怪谈控制台 】 
   ========================================= */
(function() {
    var asciiArt = `
   ______      ___     
  / ____/___  / (_)___ 
 / /   / __ \\/ / / __ \\
/ /___/ /_/ / / / / / /
\\____/\\____/_/_/_/ /_/ 
\n`;
    var message = "Welcome to Colin's Matrix.\n\n";
    var info = "Talk is cheap. Show me the shell.\n发现漏洞请手下留情，扣扣：502068770\n";
    var horrorRule = "\n[ ! ] 访客须知：无论屏幕里出现什么，绝对、绝对不要在主界面键入 'prts'，否则可能造成不可估量的后果";
    var styleArt = "color: #49b1f5; font-size: 16px; line-height: 1.2; font-weight: bold; font-family: 'Fira Code', monospace; text-shadow: 0 0 5px rgba(73,177,245,0.5);";
    var styleMsg = "color: #eee; font-size: 14px; background: #2c3e50; padding: 5px 10px; border-radius: 4px; font-family: 'Fira Code', monospace;";
    var styleInfo = "color: #42b983; font-size: 14px; font-family: 'Fira Code', monospace; margin-top: 10px;";
    var styleRule = "color: #ff0000; font-size: 16px; font-weight: 900; text-shadow: 0 0 10px #ff0000; font-family: 'Noto Serif SC', serif; margin-top: 10px; background: rgba(0,0,0,0.8);";
    console.log("%c" + asciiArt + "%c" + message + "%c" + info + "%c" + horrorRule, styleArt, styleMsg, styleInfo, styleRule);
})();