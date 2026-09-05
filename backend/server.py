from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, Request, Response, HTTPException, UploadFile, File, Form
from fastapi.responses import Response as FastAPIResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import re
import json
import logging
import uuid
import bcrypt
import jwt
import requests as http_requests
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel
from typing import List, Optional
from bson import ObjectId
from pymongo.errors import DuplicateKeyError

# Config
MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']
JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = "HS256"
ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL', 'admin@example.com')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'admin123')
EMERGENT_KEY = os.environ.get('EMERGENT_LLM_KEY')
ANTHROPIC_API_KEY = os.environ.get('ANTHROPIC_API_KEY')
ANTHROPIC_MODEL = os.environ.get('ANTHROPIC_MODEL', 'claude-sonnet-5')
COOKIE_SECURE = os.environ.get('COOKIE_SECURE', 'false').lower() == 'true'
# Cross-site cookies (separate frontend/backend domains) require SameSite=None, which
# browsers only honor when Secure is also set - so this is tied to the same flag.
COOKIE_SAMESITE = "none" if COOKIE_SECURE else "lax"
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
APP_NAME = "solopreneur-writer"

# MongoDB
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# FastAPI
app = FastAPI()
api_router = APIRouter(prefix="/api")

# Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ── Slugify ──
def slugify(text: str, max_len: int = 60) -> str:
    text = (text or "").lower().strip()
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return text[:max_len].strip("-")

# ── Object Storage ──
storage_key = None

def init_storage():
    global storage_key
    if storage_key:
        return storage_key
    resp = http_requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key

def put_object(path, data, content_type):
    key = init_storage()
    resp = http_requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120
    )
    resp.raise_for_status()
    return resp.json()

def get_object(path):
    key = init_storage()
    resp = http_requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key}, timeout=60
    )
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")

# ── Password Hashing ──
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))

# ── JWT ──
def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email, "exp": datetime.now(timezone.utc) + timedelta(minutes=15), "type": "access"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "refresh"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ── Pydantic Models ──
class RegisterInput(BaseModel):
    email: str
    password: str
    name: str = "Writer"

class LoginInput(BaseModel):
    email: str
    password: str

class ArticleCreate(BaseModel):
    title: str = "Untitled"
    subheadline: str = ""
    notes: str = ""
    article_content: str = ""
    status: str = "idea"
    tags: List[str] = []
    reference_links: List[dict] = []

class ArticleUpdate(BaseModel):
    title: Optional[str] = None
    subheadline: Optional[str] = None
    notes: Optional[str] = None
    article_content: Optional[str] = None
    status: Optional[str] = None
    tags: Optional[List[str]] = None
    reference_links: Optional[List[dict]] = None
    screenshot_paths: Optional[list] = None

class PromptUpdate(BaseModel):
    content: str

# ── Auth Endpoints ──
@api_router.post("/auth/register")
async def register(input: RegisterInput, response: Response):
    email = input.email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    hashed = hash_password(input.password)
    user_doc = {
        "email": email,
        "password_hash": hashed,
        "name": input.name,
        "role": "user",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=COOKIE_SECURE, samesite=COOKIE_SAMESITE, max_age=900, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=COOKIE_SECURE, samesite=COOKIE_SAMESITE, max_age=604800, path="/")
    await seed_prompts_for_user(user_id)
    return {"_id": user_id, "email": email, "name": input.name, "role": "user"}

@api_router.post("/auth/login")
async def login(input: LoginInput, request: Request, response: Response):
    email = input.email.lower().strip()
    ip = request.client.host if request.client else "unknown"
    identifier = f"{ip}:{email}"
    attempt = await db.login_attempts.find_one({"identifier": identifier})
    if attempt and attempt.get("count", 0) >= 5:
        lockout_until = attempt.get("locked_until")
        if lockout_until and datetime.now(timezone.utc) < datetime.fromisoformat(lockout_until):
            raise HTTPException(status_code=429, detail="Too many login attempts. Try again in 15 minutes.")
        else:
            await db.login_attempts.delete_one({"identifier": identifier})
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(input.password, user["password_hash"]):
        await db.login_attempts.update_one(
            {"identifier": identifier},
            {"$inc": {"count": 1}, "$set": {"locked_until": (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()}},
            upsert=True
        )
        raise HTTPException(status_code=401, detail="Invalid email or password")
    await db.login_attempts.delete_one({"identifier": identifier})
    user_id = str(user["_id"])
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=COOKIE_SECURE, samesite=COOKIE_SAMESITE, max_age=900, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=COOKIE_SECURE, samesite=COOKIE_SAMESITE, max_age=604800, path="/")
    return {"_id": user_id, "email": user["email"], "name": user.get("name", ""), "role": user.get("role", "user")}

@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"message": "Logged out"}

@api_router.get("/auth/me")
async def get_me(request: Request):
    user = await get_current_user(request)
    return user

@api_router.post("/auth/refresh")
async def refresh_token_endpoint(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user_id = str(user["_id"])
        access_token = create_access_token(user_id, user["email"])
        response.set_cookie(key="access_token", value=access_token, httponly=True, secure=COOKIE_SECURE, samesite=COOKIE_SAMESITE, max_age=900, path="/")
        return {"message": "Token refreshed"}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

# ── Articles ──
@api_router.post("/articles")
async def create_article(input: ArticleCreate, request: Request):
    user = await get_current_user(request)
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["_id"],
        "title": input.title,
        "subheadline": input.subheadline,
        "notes": input.notes,
        "article_content": input.article_content,
        "status": input.status,
        "tags": input.tags,
        "reference_links": input.reference_links,
        "screenshot_paths": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.articles.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}

@api_router.get("/articles")
async def list_articles(request: Request, status: Optional[str] = None, tag: Optional[str] = None):
    user = await get_current_user(request)
    query = {"user_id": user["_id"]}
    if status:
        query["status"] = status
    if tag:
        query["tags"] = tag
    articles = await db.articles.find(query, {"_id": 0}).sort("updated_at", -1).to_list(1000)
    return articles

@api_router.get("/articles/{article_id}")
async def get_article(article_id: str, request: Request):
    user = await get_current_user(request)
    article = await db.articles.find_one({"id": article_id, "user_id": user["_id"]}, {"_id": 0})
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    return article

@api_router.put("/articles/{article_id}")
async def update_article(article_id: str, input: ArticleUpdate, request: Request):
    user = await get_current_user(request)
    update_data = {k: v for k, v in input.model_dump(exclude_none=True).items()}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.articles.update_one(
        {"id": article_id, "user_id": user["_id"]},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Article not found")
    article = await db.articles.find_one({"id": article_id}, {"_id": 0})
    return article

@api_router.post("/articles/{article_id}/suggest-metadata")
async def suggest_metadata(article_id: str, request: Request):
    user = await get_current_user(request)
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=503, detail="AI suggestions are not configured. Set ANTHROPIC_API_KEY in backend/.env.")
    article = await db.articles.find_one({"id": article_id, "user_id": user["_id"]}, {"_id": 0})
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    body_text = (article.get("article_content") or article.get("notes") or "").strip()
    if not body_text:
        raise HTTPException(status_code=400, detail="Add some notes or article content before requesting suggestions.")

    prompt = f"""You are helping a writer prepare a Medium article for publishing.

Current title: {article.get('title') or '(untitled)'}

Article content / notes:
{body_text[:8000]}

Return ONLY valid JSON (no markdown fences, no commentary) with this exact shape:
{{
  "headlines": ["option 1", "option 2", "option 3"],
  "subheadlines": ["option 1", "option 2"],
  "tags": {{
    "general": ["wide tag 1", "wide tag 2", "wide tag 3"],
    "specific": ["specific tag 1", "specific tag 2"]
  }}
}}

Rules:
- headlines: 3 compelling Medium-style headline options based on the content, distinct from each other.
- subheadlines: 2 short subtitle options (Medium's supporting line under the title, under 140 characters each).
- tags.general: exactly 3 broad/wide topic tags a large audience would search (e.g. "Productivity", "Writing").
- tags.specific: exactly 2 narrower tags specific to this article's actual subject.
- All tags should follow Medium's tag conventions: 1-3 words, Title Case, no hashtags.
- Do not repeat a tag between general and specific."""

    try:
        resp = http_requests.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": ANTHROPIC_MODEL,
                "max_tokens": 1024,
                "messages": [{"role": "user", "content": prompt}],
            },
            timeout=60,
        )
        resp.raise_for_status()
    except http_requests.exceptions.RequestException as e:
        logger.error(f"Anthropic API call failed: {e}")
        raise HTTPException(status_code=502, detail="AI suggestion request failed. Please try again.")

    data = resp.json()
    raw_text = "".join(block.get("text", "") for block in data.get("content", []) if block.get("type") == "text").strip()
    raw_text = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw_text.strip())
    try:
        suggestions = json.loads(raw_text)
    except json.JSONDecodeError:
        logger.error(f"Could not parse Claude response as JSON: {raw_text[:500]}")
        raise HTTPException(status_code=502, detail="AI response could not be parsed. Please try again.")

    return suggestions

@api_router.delete("/articles/{article_id}")
async def delete_article(article_id: str, request: Request):
    user = await get_current_user(request)
    result = await db.articles.delete_one({"id": article_id, "user_id": user["_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Article not found")
    return {"message": "Article deleted"}

# ── Prompts ──
@api_router.get("/prompts")
async def list_prompts(request: Request):
    user = await get_current_user(request)
    prompts = await db.prompts.find({"user_id": user["_id"]}, {"_id": 0}).to_list(10)
    return prompts

@api_router.put("/prompts/{prompt_id}")
async def update_prompt(prompt_id: str, input: PromptUpdate, request: Request):
    user = await get_current_user(request)
    result = await db.prompts.update_one(
        {"id": prompt_id, "user_id": user["_id"]},
        {"$set": {"content": input.content, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Prompt not found")
    prompt = await db.prompts.find_one({"id": prompt_id}, {"_id": 0})
    return prompt

# ── File Upload / Download ──
@api_router.post("/upload")
async def upload_file(request: Request, file: UploadFile = File(...), title_hint: Optional[str] = Form(None)):
    user = await get_current_user(request)
    ext = file.filename.split(".")[-1] if "." in file.filename else "bin"
    original_base = file.filename.rsplit(".", 1)[0] if "." in file.filename else file.filename
    slug = slugify(title_hint) or slugify(original_base)
    unique_suffix = uuid.uuid4().hex[:8]
    filename = f"{slug}-{unique_suffix}.{ext}" if slug else f"{unique_suffix}.{ext}"
    path = f"{APP_NAME}/uploads/{user['_id']}/{filename}"
    data = await file.read()
    result = put_object(path, data, file.content_type or "application/octet-stream")
    return {"path": result["path"], "original_filename": file.filename}

@api_router.get("/files/{file_path:path}")
async def download_file(file_path: str, request: Request, auth: Optional[str] = None):
    token = request.cookies.get("access_token")
    if not token and auth:
        token = auth
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    data, content_type = get_object(file_path)
    return FastAPIResponse(content=data, media_type=content_type)

# ── Seed Functions ──
async def seed_prompts_for_user(user_id: str):
    existing = await db.prompts.find_one({"user_id": user_id})
    if existing:
        return
    prompts = [
        {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "name": "Article Outline Prompt",
            "content": "I want you to help me create a detailed outline for a Medium article about [TOPIC]. The outline should include:\n\n1. A compelling headline (3 options)\n2. A hook/introduction paragraph\n3. 5-7 main sections with bullet points for key ideas\n4. A conclusion with a call-to-action\n5. 3 potential subheadings for each section\n\nMy target audience is [AUDIENCE]. The tone should be [TONE: professional/casual/conversational]. The article should be approximately [LENGTH] words.",
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "name": "Article Draft Prompt",
            "content": "Based on the following outline and notes, write a full Medium-style article.\n\nOUTLINE:\n[PASTE YOUR OUTLINE HERE]\n\nNOTES:\n[PASTE YOUR SCRATCHPAD NOTES HERE]\n\nREFERENCE LINKS:\n[PASTE RELEVANT LINKS]\n\nWriting guidelines:\n- Use a conversational but authoritative tone\n- Start with a strong hook\n- Use short paragraphs (2-3 sentences max)\n- Include relevant examples and analogies\n- Add transition sentences between sections\n- End with a clear takeaway or call-to-action\n- Target word count: [LENGTH] words",
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    await db.prompts.insert_many(prompts)

async def seed_admin():
    admin_email = ADMIN_EMAIL.lower().strip()
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        hashed = hash_password(ADMIN_PASSWORD)
        try:
            result = await db.users.insert_one({
                "email": admin_email,
                "password_hash": hashed,
                "name": "Admin",
                "role": "admin",
                "created_at": datetime.now(timezone.utc).isoformat()
            })
        except DuplicateKeyError:
            # Another concurrent cold start already created it (serverless).
            pass
        else:
            user_id = str(result.inserted_id)
            await seed_prompts_for_user(user_id)
            logger.info(f"Admin user created: {admin_email}")
    elif not verify_password(ADMIN_PASSWORD, existing["password_hash"]):
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(ADMIN_PASSWORD)}}
        )
        logger.info(f"Admin password updated: {admin_email}")
    try:
        memory_dir = str(ROOT_DIR.parent / "memory")
        os.makedirs(memory_dir, exist_ok=True)
        with open(f"{memory_dir}/test_credentials.md", "w") as f:
            f.write("# Test Credentials\n\n")
            f.write(f"## Admin\n- Email: {admin_email}\n- Password: {ADMIN_PASSWORD}\n- Role: admin\n\n")
            f.write("## Auth Endpoints\n- POST /api/auth/register\n- POST /api/auth/login\n- POST /api/auth/logout\n- GET /api/auth/me\n- POST /api/auth/refresh\n")
    except OSError:
        # Read-only filesystem (e.g. Vercel serverless) - this file is a local dev convenience only.
        pass

# ── Startup / Shutdown ──
@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.login_attempts.create_index("identifier")
    await seed_admin()
    try:
        init_storage()
        logger.info("Object storage initialized")
    except Exception as e:
        logger.error(f"Storage init failed: {e}")

@app.on_event("shutdown")
async def shutdown():
    client.close()

# ── Root ──
@api_router.get("/")
async def root():
    return {"message": "WriteSimply API"}

# ── Include Router + CORS ──
app.include_router(api_router)

frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
