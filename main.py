import os
import threading
from flask import Flask

# --- إعداد الموقع ---
app = Flask(__name__)

@app.route('/')
def home():
    return "The server is running successfully on Railway!"

def run_web_server():
    # Railway يحدد المنفذ تلقائياً عبر متغير البيئة PORT
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port)

# --- إعداد البوت ---
def run_bot():
    print("Starting Telegram Bot...")
    # هنا ضع كود تشغيل البوت الخاص بك، مثلاً:
    # bot.polling(none_stop=True)
    pass

if __name__ == "__main__":
    # 1. تشغيل الموقع في خيط (Thread) منفصل لكي لا يتعطل البوت
    web_thread = threading.Thread(target=run_web_server)
    web_thread.daemon = True
    web_thread.start()

    # 2. تشغيل البوت في الخيط الرئيسي
    run_bot()
