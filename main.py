import os
import threading
from flask import Flask

# 1. إعداد تطبيق الويب (للموقع)
app = Flask(__name__)

@app.route('/')
def home():
    return "الموقع يعمل بنجاح على Railway!"

def run_web_server():
    # Railway يحتاج الاستماع لهذا المنفذ لتفعيل الرابط
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port)

# 2. إعداد البوت (تأكد من استدعاء دالة تشغيل بوتك هنا)
def run_telegram_bot():
    print("جاري تشغيل بوت التيليجرام...")
    # هنا تضع الكود الذي يشغل البوت الخاص بك، مثلاً:
    # my_bot.polling() 

if __name__ == "__main__":
    # تشغيل السيرفر في خيط (Thread) منفصل لكي لا يتوقف البوت
    t = threading.Thread(target=run_web_server)
    t.start()
    
    # تشغيل البوت في الخيط الرئيسي
    run_telegram_bot()
