from flask import Flask, render_template, request, jsonify, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, date
import os
import json
import traceback
from werkzeug.utils import secure_filename

app = Flask(__name__)

# 配置
app.config['SECRET_KEY'] = 'your-secret-key-here'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///love_story.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['UPLOAD_FOLDER'] = 'static/uploads'
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024

# 允许的文件类型
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

# 创建上传文件夹
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

db = SQLAlchemy(app)

# 数据库模型
class TimelineEvent(db.Model):
    __tablename__ = 'timeline_event'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    date = db.Column(db.Date, nullable=False)
    description = db.Column(db.String(500))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    # 一对多关系
    photos = db.relationship('TimelinePhoto', backref='event', lazy=True, cascade='all, delete-orphan')

class TimelinePhoto(db.Model):
    __tablename__ = 'timeline_photo'
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(200), nullable=False)
    event_id = db.Column(db.Integer, db.ForeignKey('timeline_event.id'), nullable=False)
    order = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Message(db.Model):
    __tablename__ = 'message'
    id = db.Column(db.Integer, primary_key=True)
    author = db.Column(db.String(100), nullable=False)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Photo(db.Model):
    __tablename__ = 'photo'
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(200), nullable=False)
    original_filename = db.Column(db.String(200))
    upload_date = db.Column(db.DateTime, default=datetime.utcnow)
    description = db.Column(db.String(500))
    event_id = db.Column(db.Integer, nullable=True)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# 创建数据库表
def init_db():
    with app.app_context():
        # 检查数据库是否存在
        db_path = 'love_story.db'
        if os.path.exists(db_path):
            print(f"数据库文件已存在: {db_path}")
        else:
            print(f"创建新数据库: {db_path}")
        
        db.create_all()
        print("✓ 数据库表创建/检查完成")
        
        # 验证表是否创建成功
        from sqlalchemy import inspect
        inspector = inspect(db.engine)
        tables = inspector.get_table_names()
        print(f"✓ 现有表: {tables}")

init_db()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/album')
def album():
    return render_template('album.html')

@app.route('/api/set_start_date', methods=['POST'])
def set_start_date():
    try:
        data = request.json
        start_date = data.get('start_date')
        if not start_date:
            return jsonify({'success': False, 'error': '日期不能为空'}), 400
        
        with open('start_date.txt', 'w') as f:
            f.write(start_date)
        print(f"开始日期已保存: {start_date}")
        return jsonify({'success': True})
    except Exception as e:
        print(f"设置开始日期错误: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/get_start_date')
def get_start_date():
    try:
        if os.path.exists('start_date.txt'):
            with open('start_date.txt', 'r') as f:
                start_date = f.read()
            return jsonify({'start_date': start_date})
        return jsonify({'start_date': None})
    except Exception as e:
        print(f"获取开始日期错误: {e}")
        return jsonify({'start_date': None}), 500

@app.route('/api/timeline_events', methods=['GET'])
def get_timeline_events():
    try:
        events = TimelineEvent.query.order_by(TimelineEvent.date.asc()).all()
        print(f"查询到 {len(events)} 个事件")
        
        result = []
        for e in events:
            # 获取事件关联的照片
            photos = TimelinePhoto.query.filter_by(event_id=e.id).order_by(TimelinePhoto.order).all()
            photo_filenames = [p.filename for p in photos]
            
            result.append({
                'id': e.id,
                'title': e.title,
                'date': e.date.strftime('%Y-%m-%d'),
                'description': e.description,
                'photos': photo_filenames
            })
            print(f"  - 事件: {e.title}, 照片数: {len(photo_filenames)}")
        
        return jsonify(result)
    except Exception as e:
        print(f"获取时间线事件错误: {e}")
        print(traceback.format_exc())
        return jsonify([]), 500

@app.route('/api/timeline_events', methods=['POST'])
def add_timeline_event():
    try:
        data = request.json
        print(f"收到添加事件请求: {data}")
        
        title = data.get('title')
        date_str = data.get('date')
        description = data.get('description', '')
        photo_filenames = data.get('photos', [])
        
        if not title or not date_str:
            return jsonify({'success': False, 'error': '标题和日期不能为空'}), 400
        
        event_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        
        # 创建事件
        event = TimelineEvent(
            title=title,
            date=event_date,
            description=description
        )
        db.session.add(event)
        db.session.flush()  # 获取事件ID
        print(f"创建事件 ID: {event.id}")
        
        # 添加照片到 timeline_photo 表
        for idx, filename in enumerate(photo_filenames):
            timeline_photo = TimelinePhoto(
                filename=filename,
                event_id=event.id,
                order=idx
            )
            db.session.add(timeline_photo)
            print(f"  添加照片 {idx+1}: {filename}")
            
            # 同时也添加到相册
            photo = Photo(
                filename=filename,
                original_filename=filename,
                description=f"来自时光隧道：{title}",
                event_id=event.id
            )
            db.session.add(photo)
        
        db.session.commit()
        print(f"✓ 事件保存成功，共 {len(photo_filenames)} 张照片")
        
        return jsonify({'success': True, 'id': event.id, 'photo_count': len(photo_filenames)})
        
    except Exception as e:
        print(f"添加事件错误: {e}")
        print(traceback.format_exc())
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/messages', methods=['GET'])
def get_messages():
    try:
        messages = Message.query.order_by(Message.created_at.desc()).all()
        print(f"查询到 {len(messages)} 条留言")
        
        return jsonify([{
            'id': m.id,
            'author': m.author,
            'content': m.content,
            'created_at': m.created_at.strftime('%Y-%m-%d %H:%M:%S')
        } for m in messages])
    except Exception as e:
        print(f"获取留言错误: {e}")
        return jsonify([]), 500

@app.route('/api/messages', methods=['POST'])
def add_message():
    try:
        data = request.json
        print(f"收到新留言: {data}")
        
        message = Message(
            author=data['author'],
            content=data['content']
        )
        db.session.add(message)
        db.session.commit()
        print(f"✓ 留言保存成功，ID: {message.id}")
        
        return jsonify({'success': True, 'id': message.id})
    except Exception as e:
        print(f"添加留言错误: {e}")
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/upload_timeline_photos', methods=['POST'])
def upload_timeline_photos():
    try:
        if 'photos' not in request.files:
            return jsonify({'error': 'No files uploaded'}), 400
        
        files = request.files.getlist('photos')
        print(f"收到 {len(files)} 个文件上传")
        
        uploaded_files = []
        
        for i, file in enumerate(files):
            if file.filename == '':
                continue
            
            if file and allowed_file(file.filename):
                # 生成唯一文件名
                filename = secure_filename(file.filename)
                name, ext = os.path.splitext(filename)
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S_%f')
                filename = f"{name}_{timestamp}{ext}"
                
                filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                file.save(filepath)
                uploaded_files.append(filename)
                print(f"  ✓ 保存文件 {i+1}: {filename}")
        
        print(f"成功上传 {len(uploaded_files)} 个文件")
        return jsonify({'success': True, 'filenames': uploaded_files})
        
    except Exception as e:
        print(f"上传照片错误: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/upload_photo', methods=['POST'])
def upload_photo():
    try:
        if 'photo' not in request.files:
            return jsonify({'error': 'No file uploaded'}), 400
        
        files = request.files.getlist('photo')
        print(f"收到 {len(files)} 个相册文件上传")
        
        uploaded_files = []
        
        for file in files:
            if file.filename == '':
                continue
            
            if file and allowed_file(file.filename):
                filename = secure_filename(file.filename)
                name, ext = os.path.splitext(filename)
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S_%f')
                filename = f"{name}_{timestamp}{ext}"
                
                filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                file.save(filepath)
                uploaded_files.append(filename)
                print(f"  ✓ 保存文件: {filename}")
        
        description = request.form.get('description', '')
        
        for photo_filename in uploaded_files:
            photo = Photo(
                filename=photo_filename,
                original_filename=photo_filename,
                description=description,
                event_id=None
            )
            db.session.add(photo)
        
        db.session.commit()
        print(f"成功添加 {len(uploaded_files)} 张照片到相册")
        
        return jsonify({'success': True, 'filenames': uploaded_files})
        
    except Exception as e:
        print(f"上传照片错误: {e}")
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/photos')
def get_photos():
    try:
        photos = Photo.query.order_by(Photo.upload_date.desc()).all()
        print(f"查询到 {len(photos)} 张相册照片")
        
        return jsonify([{
            'id': p.id,
            'filename': p.filename,
            'description': p.description,
            'upload_date': p.upload_date.strftime('%Y-%m-%d %H:%M:%S'),
            'event_id': p.event_id
        } for p in photos])
    except Exception as e:
        print(f"获取照片错误: {e}")
        return jsonify([]), 500

@app.route('/static/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

# 添加一个测试路由，查看数据库内容
@app.route('/api/debug/db')
def debug_db():
    try:
        events = TimelineEvent.query.all()
        messages = Message.query.all()
        photos = Photo.query.all()
        
        return jsonify({
            'events_count': len(events),
            'events': [{'id': e.id, 'title': e.title, 'date': str(e.date)} for e in events],
            'messages_count': len(messages),
            'photos_count': len(photos)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print("\n" + "="*60)
    print("启动恋爱日记应用")
    print("="*60)
    print(f"上传文件夹: {app.config['UPLOAD_FOLDER']}")
    print(f"数据库文件: love_story.db")
    print(f"访问地址: http://127.0.0.1:5000")
    print(f"调试地址: http://127.0.0.1:5000/api/debug/db")
    print("="*60 + "\n")
    
    app.run(debug=True, host='127.0.0.1', port=5000)