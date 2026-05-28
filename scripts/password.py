import os
import hashlib
import json
import struct

def xor_crypt(data: bytes, key: bytes) -> bytes:
    key_len = len(key)
    if key_len == 0:
        return data
    # Standard byte-by-byte cyclical XOR
    return bytes(data[i] ^ key[i % key_len] for i in range(len(data)))

def get_sha256(text: str) -> str:
    return hashlib.sha256(text.encode('utf-8')).hexdigest()

def main():
    # Resolve paths relative to the project root
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    
    hash_path = os.path.join(project_root, "hash.txt")
    index_path = os.path.join(project_root, "index.enc")
    enc_dir = os.path.join(project_root, "enc")
    
    has_existing = os.path.exists(hash_path)
    
    if has_existing:
        with open(hash_path, "r", encoding="utf-8") as f:
            stored_hash = f.read().strip()
            
        print("--- RREADS: Cambiar Contraseña ---")
        old_password = input("Introduce la contraseña actual: ")
        if get_sha256(old_password) != stored_hash:
            print("ERROR: Contraseña incorrecta.")
            return
            
        old_key = old_password.encode('utf-8')
    else:
        print("--- RREADS: Configurar Contraseña Inicial ---")
        old_password = None
        old_key = None

    while True:
        new_password = input("Introduce la NUEVA contraseña: ")
        if not new_password:
            print("La contraseña no puede estar vacía. Inténtalo de nuevo.")
            continue
        confirm = input("Confirma la NUEVA contraseña: ")
        if new_password != confirm:
            print("Las contraseñas no coinciden. Inténtalo de nuevo.")
            continue
        break
        
    new_key = new_password.encode('utf-8')
    
    # If we have an existing password, we need to decrypt and re-encrypt the catalog
    if has_existing:
        print("Descifrando catálogo actual...")
        
        # 1. Decrypt index.enc
        uuids = []
        if os.path.exists(index_path):
            with open(index_path, "rb") as f:
                encrypted_index = f.read()
            try:
                decrypted_index_bytes = xor_crypt(encrypted_index, old_key)
                uuids = json.loads(decrypted_index_bytes.decode('utf-8'))
                print(f"Encontrados {len(uuids)} libros en el catálogo.")
            except Exception as e:
                print(f"Error al descifrar el índice: {e}")
                print("Se cancela la operación para evitar corrupción de datos.")
                return

        # 2. Decrypt each book in memory, then encrypt with the new password
        books_data = {}
        for uuid_str in uuids:
            book_file = os.path.join(enc_dir, f"{uuid_str}.enc")
            if not os.path.exists(book_file):
                print(f"Advertencia: El archivo del libro {uuid_str}.enc no existe. Saltando...")
                continue
                
            with open(book_file, "rb") as f:
                file_bytes = f.read()
                
            # Parse header
            if len(file_bytes) < 11:
                print(f"ERROR: Archivo {uuid_str}.enc corrupto (muy pequeño).")
                return
                
            magic = file_bytes[0:6]
            version = file_bytes[6:7]
            if magic != b"RREADS":
                print(f"ERROR: Archivo {uuid_str}.enc no tiene formato RREADS válido.")
                return
                
            meta_len = struct.unpack(">I", file_bytes[7:11])[0]
            if len(file_bytes) < 11 + meta_len:
                print(f"ERROR: Archivo {uuid_str}.enc corrupto (metadatos incompletos).")
                return
                
            meta_xor = file_bytes[11:11+meta_len]
            html_xor = file_bytes[11+meta_len:]
            
            # Decrypt
            try:
                meta_json_bytes = xor_crypt(meta_xor, old_key)
                html_bytes = xor_crypt(html_xor, old_key)
                
                # Verify metadata is valid JSON just to be sure
                json.loads(meta_json_bytes.decode('utf-8'))
                
                books_data[uuid_str] = (meta_json_bytes, html_bytes, version)
            except Exception as e:
                print(f"Error al descifrar el libro {uuid_str}.enc: {e}")
                return

        # 3. If all books decrypted successfully, re-encrypt and write them
        print("Re-encriptando libros con la nueva contraseña...")
        if not os.path.exists(enc_dir):
            os.makedirs(enc_dir)
            
        for uuid_str, (meta_json_bytes, html_bytes, version) in books_data.items():
            new_meta_xor = xor_crypt(meta_json_bytes, new_key)
            new_html_xor = xor_crypt(html_bytes, new_key)
            
            header = b"RREADS" + version + struct.pack(">I", len(new_meta_xor))
            new_file_bytes = header + new_meta_xor + new_html_xor
            
            book_file = os.path.join(enc_dir, f"{uuid_str}.enc")
            with open(book_file, "wb") as f:
                f.write(new_file_bytes)
                
        # 4. Re-encrypt index.enc
        if uuids:
            index_json_bytes = json.dumps(uuids).encode('utf-8')
            new_encrypted_index = xor_crypt(index_json_bytes, new_key)
            with open(index_path, "wb") as f:
                f.write(new_encrypted_index)
                
        print("Re-encriptación completada con éxito.")

    # Write new hash
    new_hash = get_sha256(new_password)
    with open(hash_path, "w", encoding="utf-8") as f:
        f.write(new_hash)
        
    print(f"Contraseña guardada correctamente en hash.txt.")

if __name__ == "__main__":
    main()
