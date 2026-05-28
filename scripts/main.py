import os
import sys
import hashlib
import json
import uuid
import struct
from html.parser import HTMLParser

def xor_crypt(data: bytes, key: bytes) -> bytes:
    key_len = len(key)
    if key_len == 0:
        return data
    return bytes(data[i] ^ key[i % key_len] for i in range(len(data)))

def get_sha256(text: str) -> str:
    return hashlib.sha256(text.encode('utf-8')).hexdigest()

class MetaParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.metadata = {}

    def handle_starttag(self, tag, attrs):
        if tag.lower() == 'meta':
            attrs_dict = dict(attrs)
            name = attrs_dict.get('name', '').lower()
            content = attrs_dict.get('content', '')
            if name and content:
                self.metadata[name] = content

def compile_directory(src_dir, dest_dir, index_path, key):
    # Ensure source dir exists
    if not os.path.exists(src_dir):
        os.makedirs(src_dir)
        print(f"Creado directorio vacío: {src_dir}")
        print("Coloca archivos HTML de libros aquí.")
        return []

    # Ensure dest dir exists
    if not os.path.exists(dest_dir):
        os.makedirs(dest_dir)

    metadata_map_path = os.path.join(src_dir, ".build_metadata.json")
    
    # Load persistent UUID mapping
    uuid_mapping = {}
    if os.path.exists(metadata_map_path):
        try:
            with open(metadata_map_path, "r", encoding="utf-8") as f:
                uuid_mapping = json.load(f)
        except Exception as e:
            print(f"  Advertencia: No se pudo cargar {metadata_map_path}: {e}")

    html_files = [f for f in os.listdir(src_dir) if f.endswith(".html")]
    if not html_files:
        print(f"  No se encontraron libros HTML en {src_dir}.")
        return []

    active_uuids = []

    for filename in html_files:
        file_path = os.path.join(src_dir, filename)
        print(f"  Procesando {filename}...")

        with open(file_path, "r", encoding="utf-8") as f:
            html_content = f.read()

        parser = MetaParser()
        try:
            parser.feed(html_content)
        except Exception as e:
            print(f"    ERROR: No se pudo parsear {filename}: {e}")
            continue

        meta = parser.metadata

        if "title" not in meta or "author" not in meta:
            print(f"    ERROR: {filename} omitido. Falta '<meta name=\"title\">' o '<meta name=\"author\">'.")
            continue

        title = meta["title"]
        author = meta["author"]

        if filename in uuid_mapping:
            book_uuid = uuid_mapping[filename]
            print(f"    Reusando UUID: {book_uuid}")
        else:
            book_uuid = str(uuid.uuid4())
            uuid_mapping[filename] = book_uuid
            print(f"    Generado nuevo UUID: {book_uuid}")

        active_uuids.append(book_uuid)

        # Process cover path
        cover_path = meta.get("cover", "").strip()
        if not cover_path:
            cover_path = None

        # Build metadata structure
        tags = [t.strip() for t in meta["tags"].split(",") if t.strip()] if "tags" in meta else []
        pages = int(meta["pages"]) if "pages" in meta and meta["pages"].isdigit() else None
        year = int(meta["year"]) if "year" in meta and meta["year"].isdigit() else None

        metadata_dict = {
            "uuid": book_uuid,
            "title": title,
            "author": author,
            "year": year,
            "genre": meta.get("genre"),
            "tags": tags,
            "pages": pages,
            "description": meta.get("description"),
            "cover": cover_path
        }

        # Encrypt metadata & HTML
        metadata_bytes = json.dumps(metadata_dict).encode('utf-8')
        html_bytes = html_content.encode('utf-8')

        encrypted_metadata = xor_crypt(metadata_bytes, key)
        encrypted_html = xor_crypt(html_bytes, key)

        header = b"RREADS" + struct.pack(">B", 1) + struct.pack(">I", len(encrypted_metadata))
        output_file_bytes = header + encrypted_metadata + encrypted_html

        output_path = os.path.join(dest_dir, f"{book_uuid}.enc")
        with open(output_path, "wb") as out_f:
            out_f.write(output_file_bytes)

    # Save build metadata
    with open(metadata_map_path, "w", encoding="utf-8") as f:
        json.dump(uuid_mapping, f, indent=2)

    # Write index.enc
    index_bytes = json.dumps(active_uuids).encode('utf-8')
    encrypted_index = xor_crypt(index_bytes, key)
    with open(index_path, "wb") as f:
        f.write(encrypted_index)

    print(f"  Índice actualizado con {len(active_uuids)} libros.")
    
    # Cleanup orphans in this directory
    all_enc_files = [f for f in os.listdir(dest_dir) if f.endswith(".enc")]
    for enc_file in all_enc_files:
        enc_uuid = enc_file[:-4]
        if enc_uuid != "index" and enc_uuid not in active_uuids:
            os.remove(os.path.join(dest_dir, enc_file))
            print(f"  Eliminado libro huérfano: {dest_dir}/{enc_file}")
            
    return active_uuids

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    
    hash_path = os.path.join(project_root, "hash.txt")
    src_dir = os.path.join(project_root, "src")
    enc_dir = os.path.join(project_root, "enc")
    
    src_preview_dir = os.path.join(project_root, "src_preview")
    preview_dir = os.path.join(project_root, "preview")
    
    # 1. Validate password exists
    if not os.path.exists(hash_path):
        print("ERROR: No se ha configurado ninguna contraseña.")
        print("Por favor, ejecuta primero el script para establecer la contraseña:")
        print("python scripts/password.py")
        sys.exit(1)
        
    with open(hash_path, "r", encoding="utf-8") as f:
        stored_hash = f.read().strip()
        
    # 2. Authenticate
    print("--- RREADS: Compilación y Cifrado de Libros ---")
    password = input("Introduce la contraseña para compilar y cifrar: ")
    if get_sha256(password) != stored_hash:
        print("ERROR: Contraseña incorrecta.")
        sys.exit(1)
        
    key = password.encode('utf-8')
    
    # 3. Compile Private Catalog
    print("\n--- COMPILANDO CATÁLOGO PRIVADO (/src -> /enc) ---")
    compile_directory(src_dir, enc_dir, os.path.join(project_root, "index.enc"), key)
    
    # 4. Compile Guest Preview Catalog (Fixed Password: "invitado")
    print("\n--- COMPILANDO CATÁLOGO INVITADO (/src_preview -> /preview) ---")
    guest_key = b"invitado"
    compile_directory(src_preview_dir, preview_dir, os.path.join(preview_dir, "index.enc"), guest_key)
    
    # 5. Clean generated covers folder (if any remnants exist)
    covers_gen_dir = os.path.join(project_root, "assets", "covers", "generated")
    if os.path.exists(covers_gen_dir):
        import shutil
        shutil.rmtree(covers_gen_dir, ignore_errors=True)
        print("\nEliminada carpeta de portadas generadas residuales para evitar fuga de metadatos.")
        
    print("\n¡Proceso de compilación completado para todos los catálogos!")

if __name__ == "__main__":
    main()
