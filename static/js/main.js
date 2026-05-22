// 全局变量
let startDate = null;
let currentAuthor = null;
let currentEventPhotos = [];
let currentDeletingId = null;
let currentDeletingType = null;

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    loadStartDate();
    loadTimelineEvents();
    loadMessages();
    startTimer();
    
    if (window.location.pathname.includes('/album')) {
        loadPhotos();
        initPetalAnimation();
        setupUploadForm();
    } else {
        initPetalAnimation();
    }
});

// 加载开始日期
function loadStartDate() {
    fetch('/api/get_start_date')
        .then(response => response.json())
        .then(data => {
            if (data.start_date) {
                const startDateInput = document.getElementById('startDate');
                if (startDateInput) {
                    startDateInput.value = data.start_date;
                    startDate = new Date(data.start_date);
                }
            }
        })
        .catch(error => console.error('加载开始日期失败:', error));
}

// 设置开始日期
function setStartDate() {
    const dateInput = document.getElementById('startDate');
    if (!dateInput) return;
    
    const date = dateInput.value;
    if (!date) {
        showCustomAlert('Select first date', 'warning');
        return;
    }
    
    fetch('/api/set_start_date', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ start_date: date })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            startDate = new Date(date);
            showCustomAlert('Setup successful💕', 'success');
        } else {
            showCustomAlert('Setup failed: ' + data.error, 'error');
        }
    })
    .catch(error => console.error('Failed to set start date:', error));
}

// 启动计时器
function startTimer() {
    setInterval(() => {
        if (startDate && !isNaN(startDate.getTime())) {
            const now = new Date();
            const diff = now - startDate;
            
            if (diff > 0) {
                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((diff % (1000 * 60)) / 1000);
                
                const daysElem = document.getElementById('days');
                const hoursElem = document.getElementById('hours');
                const minutesElem = document.getElementById('minutes');
                const secondsElem = document.getElementById('seconds');
                
                if (daysElem) daysElem.textContent = days;
                if (hoursElem) hoursElem.textContent = hours;
                if (minutesElem) minutesElem.textContent = minutes;
                if (secondsElem) secondsElem.textContent = seconds;
            }
        }
    }, 1000);
}

// 加载时间线事件
function loadTimelineEvents() {
    fetch('/api/timeline_events')
        .then(response => response.json())
        .then(events => {
            const timeline = document.getElementById('timeline');
            if (!timeline) return;
            
            timeline.innerHTML = '';
            if (events.length === 0) {
                timeline.innerHTML = '<div style="text-align:center;padding:2rem;color:#d4728a;">Click to add a new memory! ❤️</div>';
                return;
            }
            
            events.forEach(event => {
                const eventDiv = document.createElement('div');
                eventDiv.className = 'timeline-card';
                eventDiv.onclick = () => viewEventDetails(event);
                
                let photosHtml = '';
                const photoCount = event.photos ? event.photos.length : 0;
                
                if (photoCount === 0) {
                    photosHtml = '<div class="timeline-photos no-photos">📸 No photo</div>';
                } else if (photoCount === 1) {
                    photosHtml = `
                        <div class="timeline-photos single-photo">
                            <img src="/static/uploads/${event.photos[0]}" class="timeline-photo-single" alt="photo" onerror="this.src='https://via.placeholder.com/200?text=No+Image'">
                        </div>
                    `;
                } else if (photoCount === 2) {
                    photosHtml = `
                        <div class="timeline-photos two-photos">
                            <img src="/static/uploads/${event.photos[0]}" class="timeline-photo-half" alt="photo" onerror="this.src='https://via.placeholder.com/150?text=No+Image'">
                            <img src="/static/uploads/${event.photos[1]}" class="timeline-photo-half" alt="photo" onerror="this.src='https://via.placeholder.com/150?text=No+Image'">
                        </div>
                    `;
                } else {
                    photosHtml = '<div class="timeline-photos multiple-photos">';
                    event.photos.slice(0, 3).forEach((photo, idx) => {
                        photosHtml += `<img src="/static/uploads/${photo}" class="timeline-photo-thumb" alt="photo" onerror="this.src='https://via.placeholder.com/80?text=No+Image'">`;
                    });
                    if (photoCount > 3) {
                        photosHtml += `<div class="photo-more-badge">+${photoCount - 3}</div>`;
                    }
                    photosHtml += '</div>';
                }
                
               eventDiv.innerHTML = `
    <div class="timeline-card-delete" onclick="event.stopPropagation(); deleteTimelineEvent(${event.id}, '${escapeHtml(event.title)}')">🗑️</div>
    <div class="timeline-card-date">${escapeHtml(event.date)}</div>
    <div class="timeline-card-title">${escapeHtml(event.title)}</div>
    <div class="timeline-card-desc">${escapeHtml(event.description || '💕 Memory 💕')}</div>
    ${photosHtml}
`;
                timeline.appendChild(eventDiv);
            });
            
            if (events.length > 0) {
                timeline.scrollLeft = timeline.scrollWidth;
            }
        })
        .catch(error => console.error('加载时间线失败:', error));
}

// 预览事件照片
function previewEventPhotos() {
    const filesInput = document.getElementById('eventPhotos');
    if (!filesInput) return;
    
    const files = Array.from(filesInput.files);
    const preview = document.getElementById('photoPreview');
    if (!preview) return;
    
    preview.innerHTML = '';
    currentEventPhotos = [];
    
    if (files.length === 0) {
        preview.innerHTML = '<p style="color:#c0a0ac;text-align:center;">No photos selected</p>';
        return;
    }
    
    files.forEach((file, index) => {
        if (!file.type.startsWith('image/')) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            const container = document.createElement('div');
            container.style.position = 'relative';
            container.style.display = 'inline-block';
            container.style.margin = '5px';
            
            const img = document.createElement('img');
            img.src = e.target.result;
            img.style.width = '80px';
            img.style.height = '80px';
            img.style.objectFit = 'cover';
            img.style.borderRadius = '12px';
            img.style.cursor = 'pointer';
            
            const deleteBtn = document.createElement('button');
            deleteBtn.innerHTML = '×';
            deleteBtn.style.position = 'absolute';
            deleteBtn.style.top = '-8px';
            deleteBtn.style.right = '-8px';
            deleteBtn.style.backgroundColor = '#e88a9e';
            deleteBtn.style.color = 'white';
            deleteBtn.style.border = 'none';
            deleteBtn.style.borderRadius = '50%';
            deleteBtn.style.width = '22px';
            deleteBtn.style.height = '22px';
            deleteBtn.style.cursor = 'pointer';
            deleteBtn.style.fontSize = '14px';
            
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                currentEventPhotos = currentEventPhotos.filter((_, i) => i !== index);
                container.remove();
                const dt = new DataTransfer();
                currentEventPhotos.forEach(file => dt.items.add(file));
                filesInput.files = dt.files;
            };
            
            container.appendChild(img);
            container.appendChild(deleteBtn);
            preview.appendChild(container);
        };
        reader.readAsDataURL(file);
        currentEventPhotos.push(file);
    });
    
    const countDisplay = document.createElement('div');
    countDisplay.style.marginTop = '10px';
    countDisplay.style.fontSize = '12px';
    countDisplay.style.color = '#d4728a';
    countDisplay.textContent = `selected ${files.length} photos`;
    preview.appendChild(countDisplay);
}

// 上传事件照片
async function uploadEventPhotos() {
    if (currentEventPhotos.length === 0) return [];
    
    const formData = new FormData();
    for (let photo of currentEventPhotos) {
        formData.append('photos', photo);
    }
    
    try {
        const response = await fetch('/api/upload_timeline_photos', {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        if (data.success) {
            return data.filenames;
        } else {
            return [];
        }
    } catch (error) {
        console.error('Failed to upload photos:', error);
        return [];
    }
}

// 打开添加事件模态框
function openAddEventModal() {
    const modal = document.getElementById('addEventModal');
    if (!modal) return;
    
    document.getElementById('eventTitle').value = '';
    document.getElementById('eventDate').value = '';
    document.getElementById('eventDesc').value = '';
    document.getElementById('eventPhotos').value = '';
    document.getElementById('photoPreview').innerHTML = '<p style="color:#c0a0ac;text-align:center;">No photos selected</p>';
    
    currentEventPhotos = [];
    modal.style.display = 'flex';
    modal.style.justifyContent = 'center';
    modal.style.alignItems = 'center';
}

// 关闭添加事件模态框
function closeAddEventModal() {
    const modal = document.getElementById('addEventModal');
    if (modal) modal.style.display = 'none';
}

// 添加时间线事件
async function addTimelineEvent() {
    const title = document.getElementById('eventTitle').value.trim();
    const date = document.getElementById('eventDate').value;
    const desc = document.getElementById('eventDesc').value.trim();
    
    if (!title) {
        showCustomAlert('Please enter title', 'warning');
        return;
    }
    
    if (!date) {
        showCustomAlert('Please select event date', 'warning');
        return;
    }
    
    const addBtn = event.target;
    const originalText = addBtn.textContent;
    addBtn.textContent = '⏳ Adding...';
    addBtn.disabled = true;
    
    try {
        let photoFilenames = [];
        if (currentEventPhotos.length > 0) {
            photoFilenames = await uploadEventPhotos();
        }
        
        const response = await fetch('/api/timeline_events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, date, description: desc, photos: photoFilenames })
        });
        
        const data = await response.json();
        
        if (data.success) {
            await loadTimelineEvents();
            closeAddEventModal();
            showCustomAlert(`✅ Added successful！\nevent：${title}\nphoto：${data.photo_count}`, 'success');
        } else {
            showCustomAlert('Added failed：' + (data.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        showCustomAlert('Failed to add event：' + error.message, 'error');
    } finally {
        addBtn.textContent = originalText;
        addBtn.disabled = false;
    }
}

// 查看事件详情
function viewEventDetails(event) {
    const modal = document.getElementById('viewEventModal');
    if (!modal) return;
    
    document.getElementById('viewEventTitle').textContent = event.title;
    document.getElementById('viewEventDate').innerHTML = `📅 ${event.date}`;
    document.getElementById('viewEventDesc').textContent = event.description || 'No more description';
    
    const photosGallery = document.getElementById('viewEventPhotos');
    photosGallery.innerHTML = '';
    
    if (event.photos && event.photos.length > 0) {
        photosGallery.style.display = 'grid';
        photosGallery.style.gridTemplateColumns = 'repeat(auto-fill, minmax(150px, 1fr))';
        photosGallery.style.gap = '1rem';
        
        event.photos.forEach((photo, idx) => {
            const photoDiv = document.createElement('div');
            photoDiv.className = 'event-photo-item';
            photoDiv.style.cssText = 'cursor:pointer; border-radius:12px; overflow:hidden; transition:transform 0.3s;';
            photoDiv.onclick = () => openPhotoModal(`/static/uploads/${photo}`, `${event.title} - Photo ${idx+1}`);
            photoDiv.innerHTML = `<img src="/static/uploads/${photo}" style="width:100%; height:150px; object-fit:cover;" alt="${event.title}" onerror="this.src='https://via.placeholder.com/150?text=No+Image'">`;
            photosGallery.appendChild(photoDiv);
        });
    } else {
        photosGallery.innerHTML = '<p style="text-align:center;color:#c0a0ac;">No photos available</p>';
    }
    
    modal.style.display = 'flex';
    modal.style.justifyContent = 'center';
    modal.style.alignItems = 'center';
}

// 关闭查看事件模态框
function closeViewEventModal() {
    const modal = document.getElementById('viewEventModal');
    if (modal) modal.style.display = 'none';
}

// 加载留言
function loadMessages() {
    fetch('/api/messages')
        .then(response => response.json())
        .then(messages => {
            const messagesList = document.getElementById('messagesList');
            if (!messagesList) return;
            
            messagesList.innerHTML = '';
            if (messages.length === 0) {
                messagesList.innerHTML = '<div style="text-align:center;padding:2rem;color:#d4728a;">No messages yet, click the button above to leave a sweet message! ❤️</div>';
                return;
            }
            
            messages.forEach(message => {
                const avatar = message.author === 'boy' ? '👨' : '👩';
                const authorName = message.author === 'boy' ? 'P' : 'A';
                const authorClass = message.author === 'boy' ? 'P' : 'A';
                
                const messageDiv = document.createElement('div');
                messageDiv.className = 'message-card';
                messageDiv.innerHTML = `
    <div class="message-avatar">${avatar}</div>
    <div class="message-content-wrapper">
        <div class="message-author ${authorClass}">${authorName}</div>
        <div class="message-text">${escapeHtml(message.content)}</div>
        <div class="message-date">${message.created_at}</div>
    </div>
    <div class="message-delete" onclick="deleteMessage(${message.id})">🗑️</div>
`;
                messagesList.appendChild(messageDiv);
            });
        })
        .catch(error => console.error('加载留言失败:', error));
}

// 打开留言模态框
function openMessageModal(author) {
    currentAuthor = author;
    const modal = document.getElementById('messageModal');
    
    const avatar = author === 'boy' ? '👨' : '👩';
    const title = author === 'boy' ? 'P' : 'A';
    document.getElementById('modalAvatar').innerHTML = `<div style="font-size: 3rem;">${avatar}</div><div style="color:#e88a9e;">${title}</div>`;
    document.getElementById('messageContent').value = '';
    
    modal.style.display = 'flex';
    modal.style.justifyContent = 'center';
    modal.style.alignItems = 'center';
}

// 关闭留言模态框
function closeMessageModal() {
    const modal = document.getElementById('messageModal');
    if (modal) modal.style.display = 'none';
}

// 添加留言
function addMessage() {
    const content = document.getElementById('messageContent').value.trim();
    
    if (!content) {
        showCustomAlert('请填写留言内容', 'warning');
        return;
    }
    
    fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author: currentAuthor, content: content })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            loadMessages();
            closeMessageModal();
            showCustomAlert('Message posted successfully! ❤️', 'success');
        } else {
            showCustomAlert('Failed to post message: ' + data.error, 'error');
        }
    })
    .catch(error => {
        console.error('Failed to post message:', error);
        showCustomAlert('Failed to post message, please try again', 'error');
    });
}

// 自定义提示框 - 无抖动版本
let activeAlert = null;

function showCustomAlert(message, type = 'info') {
    // 移除已有的提示框
    if (activeAlert && activeAlert.parentElement) {
        activeAlert.remove();
    }
    
    const alertDiv = document.createElement('div');
    alertDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #fff8fa, #fff0f3);
        padding: 1.5rem 2rem;
        border-radius: 30px;
        box-shadow: 0 20px 40px rgba(232, 138, 158, 0.3);
        z-index: 10000;
        text-align: center;
        min-width: 280px;
        border: 2px solid #f0c0cc;
        opacity: 0;
        transition: opacity 0.2s ease;
        pointer-events: auto;
    `;
    
    const icon = type === 'success' ? '💕' : type === 'error' ? '😢' : '💭';
    alertDiv.innerHTML = `
        <div style="font-size: 3rem; margin-bottom: 0.5rem;">${icon}</div>
        <div style="color: #d4728a; font-size: 1rem; white-space: pre-line;">${message}</div>
        <button onclick="this.parentElement.remove()" style="
            background: linear-gradient(135deg, #e88a9e, #d4728a);
            color: white;
            border: none;
            padding: 0.5rem 1.5rem;
            border-radius: 50px;
            margin-top: 1rem;
            cursor: pointer;
            font-size: 0.9rem;
        ">yes</button>
    `;
    
    document.body.appendChild(alertDiv);
    activeAlert = alertDiv;
    
    // 淡入动画
    setTimeout(() => {
        alertDiv.style.opacity = '1';
    }, 10);
    
    // 自动移除
    setTimeout(() => {
        if (alertDiv.parentElement) {
            alertDiv.style.opacity = '0';
            setTimeout(() => {
                if (alertDiv.parentElement) alertDiv.remove();
                if (activeAlert === alertDiv) activeAlert = null;
            }, 200);
        }
    }, 3000);
}

// 设置相册上传表单
function setupUploadForm() {
    const form = document.getElementById('uploadForm');
    if (!form) return;
    
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const formData = new FormData();
        const filesInput = document.getElementById('photoInput');
        const files = filesInput ? filesInput.files : [];
        const description = document.getElementById('photoDesc');
        
        if (files.length === 0) {
            showCustomAlert('Select the photo to upload', 'warning');
            return;
        }
        
        for (let i = 0; i < files.length; i++) {
            formData.append('photo', files[i]);
        }
        formData.append('description', description ? description.value : '');
        
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = '⏳ Uploading...';
        submitBtn.disabled = true;
        
        fetch('/api/upload_photo', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showCustomAlert(`✅ Successfully uploaded ${data.filenames.length} photos!`, 'success');
                loadPhotos();
                if (filesInput) filesInput.value = '';
                if (description) description.value = '';
                const fileCount = document.getElementById('fileCount');
                if (fileCount) fileCount.textContent = 'Not selected';
            } else {
                showCustomAlert('Upload failed: ' + (data.error || 'Unknown error'), 'error');
            }
        })
        .catch(error => {
            showCustomAlert('Upload failed, please try again', 'error');
        })
        .finally(() => {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        });
    });
}

// 加载照片到相册
function loadPhotos() {
    fetch('/api/photos')
        .then(response => response.json())
        .then(photos => {
            const gallery = document.getElementById('photoGallery');
            if (!gallery) return;
            
            gallery.innerHTML = '';
            
            if (photos.length === 0) {
                gallery.innerHTML = '<div style="text-align:center;padding:2rem;background:white;border-radius:20px;color:#d4728a;">No photos yet, upload some sweet memories! ❤️</div>';
                return;
            }
            
            // 修改后的代码（注意传递了 photo.id）：
photos.forEach(photo => {
    const item = document.createElement('div');
    item.className = 'gallery-item';
   item.innerHTML = `
                    <img src="/static/uploads/${photo.filename}" alt="${photo.description || 'memory'}" onerror="this.src='https://via.placeholder.com/250?text=No+Image'">
                    <div class="gallery-overlay">
                        <div class="gallery-description">${escapeHtml(photo.description || 'memory')}</div>
                        <div class="gallery-date">${photo.upload_date}</div>
                        <button class="gallery-delete-btn" onclick="event.stopPropagation(); deletePhoto(${photo.id}, '${photo.filename}')">🗑️ delete</button>
                    </div>
                `;
                item.onclick = () => openPhotoModal(`/static/uploads/${photo.filename}`, photo.description || 'memory');                gallery.appendChild(item);
            });
        })
        .catch(error => console.error('Photos loading failed:', error));
}

// 打开照片放大模态框
// 替换后的代码：
function openPhotoModal(imgSrc, caption) {
    // 调用带删除按钮的版本，但因为没有 photoId，所以删除按钮不显示
    openPhotoModalWithDelete(imgSrc, caption, null);
}

// 关闭照片放大模态框
function closePhotoModal() {
    const modal = document.getElementById('photoModal');
    if (modal) modal.style.display = 'none';
    const deleteBtn = document.getElementById('photoModalDeleteBtn');
    if (deleteBtn) deleteBtn.style.display = 'none';
}
// 在 closePhotoModal 函数后面添加
function openPhotoModalWithDelete(imgSrc, caption, photoId) {
    const modal = document.getElementById('photoModal');
    const modalImg = document.getElementById('modalImage');
    const captionText = document.getElementById('modalCaption');
    
    // 检查是否已有删除按钮
    let deleteBtn = document.getElementById('photoModalDeleteBtn');
    if (!deleteBtn) {
        deleteBtn = document.createElement('button');
        deleteBtn.id = 'photoModalDeleteBtn';
        deleteBtn.innerHTML = '🗑️ delete';
        deleteBtn.style.cssText = `
            position: absolute;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, #e88a9e, #d4728a);
            color: white;
            border: none;
            padding: 0.6rem 1.5rem;
            border-radius: 50px;
            cursor: pointer;
            font-size: 0.9rem;
            z-index: 1003;
            transition: all 0.3s;
        `;
        deleteBtn.onmouseover = () => {
            deleteBtn.style.transform = 'translateX(-50%) scale(1.05)';
        };
        deleteBtn.onmouseout = () => {
            deleteBtn.style.transform = 'translateX(-50%) scale(1)';
        };
        document.body.appendChild(deleteBtn);
    }
    
    // 如果有 photoId，显示删除按钮并绑定删除事件
    if (photoId) {
        deleteBtn.onclick = async () => {
            modal.style.display = 'none';
            deleteBtn.style.display = 'none';
            await deletePhoto(photoId, '');
        };
        deleteBtn.style.display = 'block';
    } else {
        deleteBtn.style.display = 'none';
    }
    
    modal.style.display = 'flex';
    modal.style.justifyContent = 'center';
    modal.style.alignItems = 'center';
    modalImg.src = imgSrc;
    captionText.innerHTML = caption;
}
// 恢复原来的 openPhotoModal 函数
function openPhotoModal(imgSrc, caption) {
    const modal = document.getElementById('photoModal');
    const modalImg = document.getElementById('modalImage');
    const captionText = document.getElementById('modalCaption');
    
    modal.style.display = 'flex';
    modal.style.justifyContent = 'center';
    modal.style.alignItems = 'center';
    modalImg.src = imgSrc;
    captionText.innerHTML = caption;
}

// 优化花瓣动画 - 白色鸡蛋花
function initPetalAnimation() {
    const canvas = document.getElementById('petalCanvas');
    if (!canvas) return;
    
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    const ctx = canvas.getContext('2d');
    let petals = [];
    
    class Petal {
        constructor() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height - canvas.height;
            this.size = Math.random() * 18 + 8;
            this.speedY = Math.random() * 2 + 1.5;
            this.speedX = (Math.random() - 0.5) * 1.5;
            this.rotation = Math.random() * Math.PI * 2;
            this.rotationSpeed = (Math.random() - 0.5) * 0.03;
            this.opacity = Math.random() * 0.5 + 0.4;
        }
        
        draw() {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.rotation);
            ctx.globalAlpha = this.opacity;
            
            // 绘制鸡蛋花形状 - 5个花瓣
            ctx.beginPath();
            for (let i = 0; i < 5; i++) {
                const angle = (i / 5) * Math.PI * 2;
                // 花瓣向外延伸
                const r = this.size;
                const x = Math.cos(angle) * r;
                const y = Math.sin(angle) * r;
                
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    // 使用二次贝塞尔曲线使花瓣更自然
                    const cpX = Math.cos(angle - 0.3) * r * 0.6;
                    const cpY = Math.sin(angle - 0.3) * r * 0.6;
                    ctx.quadraticCurveTo(cpX, cpY, x, y);
                }
            }
            ctx.closePath();
            
            // 白色花瓣渐变
            const gradient = ctx.createLinearGradient(-this.size/2, -this.size/2, this.size/2, this.size/2);
            gradient.addColorStop(0, '#ffffff');
            gradient.addColorStop(0.5, '#fff8f0');
            gradient.addColorStop(1, '#fff0e0');
            ctx.fillStyle = gradient;
            ctx.fill();
            
            // 花瓣边缘淡黄色
            ctx.beginPath();
            for (let i = 0; i < 5; i++) {
                const angle = (i / 5) * Math.PI * 2;
                const r = this.size * 0.85;
                const x = Math.cos(angle) * r;
                const y = Math.sin(angle) * r;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fillStyle = '#fff5e8';
            ctx.fill();
            
            // 花心 - 黄色
            ctx.beginPath();
            ctx.arc(0, 0, this.size * 0.25, 0, Math.PI * 2);
            ctx.fillStyle = '#ffdd99';
            ctx.fill();
            
            // 花心中心 - 深黄色
            ctx.beginPath();
            ctx.arc(0, 0, this.size * 0.12, 0, Math.PI * 2);
            ctx.fillStyle = '#ffcc88';
            ctx.fill();
            
            ctx.restore();
        }
        
        update() {
            this.y += this.speedY;
            this.x += this.speedX;
            this.rotation += this.rotationSpeed;
            
            if (this.y > canvas.height) {
                this.y = -this.size;
                this.x = Math.random() * canvas.width;
            }
            if (this.x > canvas.width) this.x = 0;
            if (this.x < 0) this.x = canvas.width;
        }
    }
    
    // 创建50片花瓣
    for (let i = 0; i < 50; i++) {
        petals.push(new Petal());
    }
    
    function animate() {
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        petals.forEach(petal => {
            petal.update();
            petal.draw();
        });
        requestAnimationFrame(animate);
    }
    
    animate();
    
    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    });
}

// 防止XSS攻击
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 点击模态框外部关闭
window.onclick = function(event) {
    const addModal = document.getElementById('addEventModal');
    if (addModal && event.target === addModal) {
        addModal.style.display = 'none';
    }
    const viewModal = document.getElementById('viewEventModal');
    if (viewModal && event.target === viewModal) {
        viewModal.style.display = 'none';
    }
    const messageModal = document.getElementById('messageModal');
    if (messageModal && event.target === messageModal) {
        messageModal.style.display = 'none';
    }
    const photoModal = document.getElementById('photoModal');
    if (photoModal && event.target === photoModal) {
        photoModal.style.display = 'none';
    }
}


// 删除时间轴事件
async function deleteTimelineEvent(eventId, eventTitle) {
    const confirmed = await confirmDialog(`Are you sure you wanna delete 「${eventTitle}」 this memory?`, 'warning');
    if (!confirmed) return;
    
    try {
        const response = await fetch(`/api/timeline_events/${eventId}`, {
            method: 'DELETE'
        });
        const data = await response.json();
        
        if (data.success) {
            showCustomAlert('Deleted successfully!💔', 'success');
            loadTimelineEvents();
            loadPhotos();
        } else {
            showCustomAlert('Delete failed: ' + data.error, 'error');
        }
    } catch (error) {
        showCustomAlert('Delete failed, please try again', 'error');
    }
}

// 删除留言
async function deleteMessage(messageId) {
    const confirmed = await confirmDialog('Are you sure you wanna delete this message?', 'warning');
    if (!confirmed) return;
    
    try {
        const response = await fetch(`/api/messages/${messageId}`, {
            method: 'DELETE'
        });
        const data = await response.json();
        
        if (data.success) {
            showCustomAlert('Message deleted successfully', 'success');
            loadMessages();
        } else {
            showCustomAlert('Delete failed: ' + data.error, 'error');
        }
    } catch (error) {
        showCustomAlert('Delete failed, please try again', 'error');
    }
}

// 删除相册照片
async function deletePhoto(photoId, filename) {
    const confirmed = await confirmDialog('Are you sure you wanna delete', 'warning');
    if (!confirmed) return;
    
    try {
        const response = await fetch(`/api/photos/${photoId}`, {
            method: 'DELETE'
        });
        const data = await response.json();
        
        if (data.success) {
            showCustomAlert('Deleted successfully', 'success');
            loadPhotos();
        } else {
            showCustomAlert('Delete failed: ' + data.error, 'error');
        }
    } catch (error) {
        showCustomAlert('Delete failed, please try again', 'error');
    }
}

// 自定义确认对话框
function confirmDialog(message, type = 'info') {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(4px);
            z-index: 10001;
            display: flex;
            justify-content: center;
            align-items: center;
        `;
        
        const icon = type === 'warning' ? '⚠️' : '💭';
        modal.innerHTML = `
            <div style="
                background: linear-gradient(135deg, #fff8fa, #fff0f3);
                border-radius: 30px;
                padding: 2rem;
                max-width: 350px;
                text-align: center;
                animation: slideDown 0.3s;
            ">
                <div style="font-size: 3rem; margin-bottom: 1rem;">${icon}</div>
                <div style="color: #d4728a; margin-bottom: 1.5rem;">${message}</div>
                <div style="display: flex; gap: 1rem; justify-content: center;">
                    <button class="confirm-no" style="
                        background: #f0c0cc;
                        color: #d4728a;
                        border: none;
                        padding: 0.6rem 1.5rem;
                        border-radius: 50px;
                        cursor: pointer;
                        font-size: 0.9rem;
                    ">no</button>
                    <button class="confirm-yes" style="
                        background: linear-gradient(135deg, #e88a9e, #d4728a);
                        color: white;
                        border: none;
                        padding: 0.6rem 1.5rem;
                        border-radius: 50px;
                        cursor: pointer;
                        font-size: 0.9rem;
                    ">yes</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        modal.querySelector('.confirm-yes').onclick = () => {
            modal.remove();
            resolve(true);
        };
        
        modal.querySelector('.confirm-no').onclick = () => {
            modal.remove();
            resolve(false);
        };
        
        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.remove();
                resolve(false);
            }
        };
    });
}

// 全局函数
window.setStartDate = setStartDate;
window.openAddEventModal = openAddEventModal;
window.closeAddEventModal = closeAddEventModal;
window.addTimelineEvent = addTimelineEvent;
window.previewEventPhotos = previewEventPhotos;
window.openMessageModal = openMessageModal;
window.closeMessageModal = closeMessageModal;
window.addMessage = addMessage;
window.openPhotoModal = openPhotoModal;
window.closePhotoModal = closePhotoModal;
window.closeViewEventModal = closeViewEventModal;
// 添加删除相关的全局函数
window.deleteTimelineEvent = deleteTimelineEvent;
window.deleteMessage = deleteMessage;
window.deletePhoto = deletePhoto;
window.openPhotoModalWithDelete = openPhotoModalWithDelete;