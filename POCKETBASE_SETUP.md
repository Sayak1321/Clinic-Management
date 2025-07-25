PocketBase Setup Helper
======================

1. **Install PocketBase:**  
   Visit https://pocketbase.io/docs/ and download the PocketBase binary for your OS. Place it in your project root or a `tools` folder.

2. **Start the PocketBase server:**  
   ```bash
   ./pocketbase serve
   ```

3. **Access the admin UI:**  
   Open [http://127.0.0.1:8090/_/](http://127.0.0.1:8090/_/) in your browser to manage collections and users.

4. **Install the JavaScript SDK for client integration:**  
   ```bash
   npm install pocketbase
   ```

5. **Integrate PocketBase in your React app:**
   - Import and initialize the SDK:
     ```js
     import PocketBase from 'pocketbase';
     const pb = new PocketBase('http://127.0.0.1:8090');
     ```
   - Authenticate users (example for login):
     ```js
     await pb.collection('users').authWithPassword(email, password);
     ```
   - Use `pb.collection('your_collection')` to interact with your data (CRUD operations).

6. **More info:**
   - See the [PocketBase JS SDK docs](https://pocketbase.io/docs/js-client-sdk/) for advanced usage and examples.
