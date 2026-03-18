// ==========================================
// 1. SUPABASE INITIALIZATION
// ==========================================
// TODO: Replace these with your actual Supabase URL and Anon Key!
const supabaseUrl = 'https://tfhmzeqxozrobldzjtvo.supabase.co';
const supabaseKey = 'sb_publishable_-z3nlK3HM1jDe5hqeYzmmQ_o_puGbcn';
const db = supabase.createClient(supabaseUrl, supabaseKey);

// Global State
let currentProfileId = null;

// ==========================================
// 2. DOM ELEMENTS & EVENT LISTENERS
// ==========================================
const ui = {
    // Left Panel
    profileInput: document.getElementById('profile-input'),
    btnAdd: document.getElementById('btn-add'),
    btnLookup: document.getElementById('btn-lookup'),
    btnDelete: document.getElementById('btn-delete'),
    profileList: document.getElementById('profile-list'),
    
    // Centre Panel
    profileImage: document.getElementById('profile-image'),
    profileName: document.getElementById('profile-name'),
    profileStatus: document.getElementById('profile-status'),
    profileQuote: document.getElementById('profile-quote'),
    friendsList: document.getElementById('friends-list'),
    
    // Right Panel
    statusInput: document.getElementById('status-input'),
    btnUpdateStatus: document.getElementById('btn-update-status'),
    quoteInput: document.getElementById('quote-input'),
    btnUpdateQuote: document.getElementById('btn-update-quote'),
    pictureInput: document.getElementById('picture-input'),
    btnUpdatePicture: document.getElementById('btn-update-picture'),
    friendInput: document.getElementById('friend-input'),
    btnAddFriend: document.getElementById('btn-add-friend'),
    btnRemoveFriend: document.getElementById('btn-remove-friend'),
    
    // Footer
    statusBar: document.getElementById('status-bar')
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    loadProfiles();

    // Attach Click Listeners
    ui.btnAdd.addEventListener('click', addProfile);
    ui.btnLookup.addEventListener('click', lookupProfile);
    ui.btnDelete.addEventListener('click', deleteProfile);
    
    ui.btnUpdateStatus.addEventListener('click', updateStatus);
    ui.btnUpdateQuote.addEventListener('click', updateQuote);
    ui.btnUpdatePicture.addEventListener('click', handlePictureUpdate);
    
    ui.btnAddFriend.addEventListener('click', addFriend);
    ui.btnRemoveFriend.addEventListener('click', removeFriend);
});

// Helper: Show status messages in the footer
function setStatus(message, isError = false) {
    ui.statusBar.textContent = message;
    ui.statusBar.className = `status-${isError ? 'error' : 'success'} text-white text-center py-2 small fixed-bottom`;
    setTimeout(() => {
        ui.statusBar.className = 'bg-dark text-white text-center py-2 small fixed-bottom';
    }, 4000);
}

// ==========================================
// 3. PROFILE MANAGEMENT (Left Panel)
// ==========================================

async function loadProfiles() {
    try {
        const { data, error } = await db
            .from('profiles')
            .select('id, name, picture')
            .order('name', { ascending: true });

        if (error) throw error;

        ui.profileList.innerHTML = data.map(profile => `
            <li class="list-group-item profile-item" data-id="${profile.id}" onclick="selectProfile('${profile.id}')">
                <img src="${profile.picture}" class="profile-item-img" alt="${profile.name}">
                <span>${profile.name}</span>
            </li>
        `).join('');
    } catch (err) {
        setStatus(`Error loading profiles: ${err.message}`, true);
    }
}

async function addProfile() {
    const name = ui.profileInput.value.trim();
    if (!name) return setStatus("Please enter a name to add.", true);

    try {
        const { error } = await db.from('profiles').insert([{ name }]);
        if (error) throw error;

        ui.profileInput.value = '';
        setStatus(`Profile '${name}' added successfully!`);
        await loadProfiles();
        lookupProfile(name); // Auto-select the new profile
    } catch (err) {
        setStatus(`Could not add profile: ${err.message}`, true);
    }
}

async function lookupProfile(forcedName = null) {
    const name = typeof forcedName === 'string' ? forcedName : ui.profileInput.value.trim();
    if (!name) return setStatus("Please enter a name to lookup.", true);

    try {
        const { data, error } = await db
            .from('profiles')
            .select('id')
            .ilike('name', `%${name}%`)
            .limit(1)
            .single();

        if (error || !data) throw new Error("Profile not found.");
        
        selectProfile(data.id);
        setStatus(`Found profile for '${name}'.`);
    } catch (err) {
        setStatus(err.message, true);
    }
}

async function deleteProfile() {
    if (!currentProfileId) return setStatus("No profile selected to delete.", true);
    
    if (!confirm("Are you sure you want to delete this profile?")) return;

    try {
        const { error } = await db.from('profiles').delete().eq('id', currentProfileId);
        if (error) throw error;

        currentProfileId = null;
        ui.profileName.innerText = "Select a Profile";
        ui.profileStatus.innerText = "No profile selected.";
        ui.profileQuote.innerText = "...";
        ui.profileImage.src = "https://1r3uutu0laz9llhm.public.blob.vercel-storage.com/avatars/default.webp";
        ui.friendsList.innerHTML = "";
        
        setStatus("Profile deleted successfully.");
        loadProfiles();
    } catch (err) {
        setStatus(`Error deleting profile: ${err.message}`, true);
    }
}

// ==========================================
// 4. DISPLAY PROFILE & FRIENDS (Centre Panel)
// ==========================================

async function selectProfile(profileId) {
    currentProfileId = profileId;
    
    // Highlight active item in the list
    document.querySelectorAll('.profile-item').forEach(el => {
        el.classList.toggle('active', el.dataset.id === profileId);
    });

    try {
        // 1. Fetch Main Profile
        const { data: profile, error: profileError } = await db
            .from('profiles')
            .select('*')
            .eq('id', profileId)
            .single();

        if (profileError) throw profileError;

        // 2. Fetch Friend Relationships (Two-Way Safe Fetch)
        const { data: friendLinks, error: friendsError } = await db
            .from('friends')
            .select('profile_id, friend_id')
            .or(`profile_id.eq.${profileId},friend_id.eq.${profileId}`);

        if (friendsError) throw friendsError;

        // Extract IDs of the *other* person
        const friendIds = friendLinks.map(link => 
            link.profile_id === profileId ? link.friend_id : link.profile_id
        );

        // 3. Fetch Friend Names
        let friends = [];
        if (friendIds.length > 0) {
            const { data: profiles, error: namesError } = await db
                .from('profiles')
                .select('name')
                .in('id', friendIds)
                .order('name', { ascending: true });
            if (namesError) throw namesError;
            friends = profiles;
        }

        // 4. Update UI
        ui.profileName.innerText = profile.name;
        ui.profileStatus.innerText = profile.status || 'No status set.';
        ui.profileQuote.innerText = profile.quote || 'No quote set.';
        ui.profileImage.src = profile.picture;
        
        if (friends.length === 0) {
            ui.friendsList.innerHTML = `<li class="list-group-item text-muted small">No friends yet.</li>`;
        } else {
            ui.friendsList.innerHTML = friends.map(f => `<li class="list-group-item">${f.name}</li>`).join('');
        }
        
        setStatus(`Displaying ${profile.name}`);
    } catch (err) {
        setStatus(`Error loading profile details: ${err.message}`, true);
    }
}

// ==========================================
// 5. EDIT PROFILE (Right Panel)
// ==========================================

async function updateStatus() {
    if (!currentProfileId) return setStatus("Please select a profile first.", true);
    const newStatus = ui.statusInput.value.trim();

    try {
        const { error } = await db.from('profiles').update({ status: newStatus }).eq('id', currentProfileId);
        if (error) throw error;
        
        ui.statusInput.value = '';
        selectProfile(currentProfileId);
        setStatus("Status updated!");
    } catch (err) {
        setStatus(`Error updating status: ${err.message}`, true);
    }
}

async function updateQuote() {
    if (!currentProfileId) return setStatus("Please select a profile first.", true);
    const newQuote = ui.quoteInput.value.trim();

    try {
        const { error } = await db.from('profiles').update({ quote: newQuote }).eq('id', currentProfileId);
        if (error) throw error;
        
        ui.quoteInput.value = '';
        selectProfile(currentProfileId);
        setStatus("Quote updated!");
    } catch (err) {
        setStatus(`Error updating quote: ${err.message}`, true);
    }
}

// Vercel Blob Upload Integration
async function handlePictureUpdate() {
    if (!currentProfileId) return setStatus("Please select a profile first.", true);
    const file = ui.pictureInput.files[0];
    if (!file) return setStatus("Please select an image file first.", true);

    const originalBtnText = ui.btnUpdatePicture.innerText;
    ui.btnUpdatePicture.innerText = "Uploading...";
    ui.btnUpdatePicture.disabled = true;

    try {
        // 1. Send file to Serverless Function
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch('/api/upload-avatar', { method: 'POST', body: formData });
        
        // Safe parsing to catch Vercel 404 HTML pages
        const rawText = await response.text();
        let result;
        try { result = JSON.parse(rawText); } catch { throw new Error(`Server returned non-JSON: ${response.status}`); }
        if (!response.ok) throw new Error(result.error || "Upload failed");

        // 2. Update Supabase with new URL
        const { error } = await db.from('profiles').update({ picture: result.url }).eq('id', currentProfileId);
        if (error) throw error;
        
        ui.pictureInput.value = '';
        selectProfile(currentProfileId);
        loadProfiles(); // Refresh left panel thumbnail
        setStatus("Picture updated successfully!");
    } catch (err) {
        setStatus(`Error uploading picture: ${err.message}`, true);
    } finally {
        ui.btnUpdatePicture.innerText = originalBtnText;
        ui.btnUpdatePicture.disabled = false;
    }
}

// ==========================================
// 6. FRIEND MANAGEMENT
// ==========================================

async function addFriend() {
    if (!currentProfileId) return setStatus("Please select a profile first.", true);
    const friendName = ui.friendInput.value.trim();
    if (!friendName) return setStatus("Please enter a friend's name.", true);

    try {
        // Find the friend's ID
        const { data: friend, error: findError } = await db
            .from('profiles')
            .select('id')
            .eq('name', friendName)
            .single();

        if (findError || !friend) throw new Error(`Could not find a profile named '${friendName}'.`);
        if (friend.id === currentProfileId) throw new Error("You cannot add yourself as a friend.");

        // Insert unique pairing (smallest UUID goes to profile_id)
        const profile_id = currentProfileId < friend.id ? currentProfileId : friend.id;
        const friend_id = currentProfileId < friend.id ? friend.id : currentProfileId;

        const { error: insertError } = await db.from('friends').insert([{ profile_id, friend_id }]);
        if (insertError && insertError.code === '23505') throw new Error("Already friends!");
        if (insertError) throw insertError;

        ui.friendInput.value = '';
        selectProfile(currentProfileId);
        setStatus(`Added ${friendName} as a friend!`);
    } catch (err) {
        setStatus(`Error adding friend: ${err.message}`, true);
    }
}

async function removeFriend() {
    if (!currentProfileId) return setStatus("Please select a profile first.", true);
    const friendName = ui.friendInput.value.trim();
    if (!friendName) return setStatus("Please enter a friend's name.", true);

    try {
        const { data: friend, error: findError } = await db
            .from('profiles')
            .select('id')
            .eq('name', friendName)
            .single();

        if (findError || !friend) throw new Error(`Could not find a profile named '${friendName}'.`);

        const profile_id = currentProfileId < friend.id ? currentProfileId : friend.id;
        const friend_id = currentProfileId < friend.id ? friend.id : currentProfileId;

        const { error: deleteError } = await db
            .from('friends')
            .delete()
            .match({ profile_id, friend_id });

        if (deleteError) throw deleteError;

        ui.friendInput.value = '';
        selectProfile(currentProfileId);
        setStatus(`Removed ${friendName} from friends.`);
    } catch (err) {
        setStatus(`Error removing friend: ${err.message}`, true);
    }
}