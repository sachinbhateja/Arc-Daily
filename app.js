// 1. Arc Configuration
const CONTRACT_ADDRESS = "0xEAEe20a539C550515e22BCaD3eD5e0832b59d1d6";
const ARC_CHAIN_ID = 5042002;
const ARC_CHAIN_ID_HEX = "0x4cef52";
const ARC_RPC_URL = "https://rpc.testnet.arc.network";
const ARC_EXPLORER = "https://testnet.arcscan.app";

const ABI = [
    "function checkIn() external",
    "function getUserData(address) view returns (uint256, uint256)",
    "function getLeaderboard() view returns (address[], uint256[])"
];

// 2. DOM Elements
const connectBtn = document.getElementById("connectBtn");
const checkInBtn = document.getElementById("checkInBtn");
const statusText = document.getElementById("status");
const timerText = document.getElementById("timer");
const streakDisplay = document.getElementById("streakDisplay");
const leaderboardList = document.getElementById("leaderboardList");
const walletBadge = document.getElementById("walletBadge");
const walletAddress = document.getElementById("walletAddress");

let provider, signer, contract;
let countdownInterval;

// 3. Connect Wallet
async function connectWallet() {
    if (window.ethereum) {
        try {
            statusText.innerText = "Initializing...";
            
            await window.ethereum.request({ method: "eth_requestAccounts" });
            provider = new ethers.BrowserProvider(window.ethereum);
            signer = await provider.getSigner();

            // Force Arc Network
            const network = await provider.getNetwork();
            if (Number(network.chainId) !== ARC_CHAIN_ID) {
                statusText.innerText = "Switching to Arc...";
                await switchToArc();
                provider = new ethers.BrowserProvider(window.ethereum);
                signer = await provider.getSigner();
            }

            contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
            const address = await signer.getAddress();
            
            // Update UI
            walletAddress.innerText = address.substring(0, 6) + "..." + address.substring(38);
            walletBadge.classList.remove("hidden");
            connectBtn.classList.add("hidden");
            checkInBtn.classList.remove("hidden");
            statusText.innerText = "Ready to streak!";

            await loadUserData();
            await loadLeaderboard();

        } catch (error) {
            console.error(error);
            statusText.innerText = "Connection failed";
        }
    } else {
        alert("Please install MetaMask!");
    }
}

// 4. Force Switch to Arc
async function switchToArc() {
    try {
        await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: ARC_CHAIN_ID_HEX }],
        });
    } catch (error) {
        if (error.code === 4902) {
            await window.ethereum.request({
                method: "wallet_addEthereumChain",
                params: [{
                    chainId: ARC_CHAIN_ID_HEX,
                    chainName: "Arc Testnet",
                    rpcUrls: [ARC_RPC_URL],
                    nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
                    blockExplorerUrls: [ARC_EXPLORER]
                }],
            });
        } else {
            throw error;
        }
    }
}

// 5. Load User Data
async function loadUserData() {
    if (!contract) return;
    const address = await signer.getAddress();
    
    try {
        const [lastCheckIn, streak] = await contract.getUserData(address);
        streakDisplay.innerText = streak.toString();

        const nextCheckInTime = (Number(lastCheckIn) + 86400) * 1000;
        const now = Date.now();

        if (now >= nextCheckInTime) {
            enableButton();
        } else {
            disableButton();
            startCountdown(nextCheckInTime);
        }
    } catch (e) {
        console.error("New user:", e);
        streakDisplay.innerText = "0";
        enableButton();
    }
}

// 6. Load Leaderboard (Clean Layout)
async function loadLeaderboard() {
    if (!contract) return;
    try {
        const result = await contract.getLeaderboard();
        const users = result[0]; const streaks = result[1]; 
        
        let data = users.map((u, i) => ({ address: u, streak: Number(streaks[i]) }));
        data.sort((a, b) => b.streak - a.streak);

        leaderboardList.innerHTML = "";
        if(data.length === 0) {
            leaderboardList.innerHTML = "<li class='empty-state'>No streaks yet. Be the first!</li>";
            return;
        }

        data.slice(0, 10).forEach((user, index) => {
            const li = document.createElement("li");
            const shortAddr = user.address.substring(0, 6) + "...";
            
            let rankClass = "rank-" + (index + 1);
            let rankText = index + 1;
            if (index === 0) rankText = "🥇";
            if (index === 1) rankText = "🥈";
            if (index === 2) rankText = "🥉";

            li.innerHTML = `
                <span class="rank ${rankClass}">${rankText}</span>
                <span class="addr">${shortAddr}</span>
                <span class="score">${user.streak}</span>
            `;
            leaderboardList.appendChild(li);
        });

    } catch (error) {
        console.error(error);
        leaderboardList.innerHTML = "<li class='empty-state'>Failed to load</li>";
    }
}

// 7. Timer & Button Logic
function startCountdown(targetTime) {
    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = setInterval(() => {
        const now = Date.now();
        const distance = targetTime - now;

        if (distance < 0) {
            clearInterval(countdownInterval);
            enableButton();
            return;
        }
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        timerText.innerText = `${hours}h ${minutes}m ${seconds}s`;
        timerText.style.color = "#fbbf24"; // Amber
        statusText.innerText = "Cooldown Active";
    }, 1000);
}

function enableButton() {
    checkInBtn.disabled = false;
    checkInBtn.innerHTML = "Claim Daily Check-In <div class='btn-glow'></div>";
    timerText.innerText = "Ready!";
    timerText.style.color = "#10b981"; // Emerald
    statusText.innerText = "Maintain your streak";
    if (countdownInterval) clearInterval(countdownInterval);
}

function disableButton() {
    checkInBtn.disabled = true;
    checkInBtn.innerText = "Come Back Tomorrow";
}

// 8. Check In Action
async function handleCheckIn() {
    try {
        const network = await provider.getNetwork();
        if (Number(network.chainId) !== ARC_CHAIN_ID) {
            await switchToArc();
            provider = new ethers.BrowserProvider(window.ethereum);
            signer = await provider.getSigner();
        }

        const safeContract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
        statusText.innerText = "Confirming...";
        const tx = await safeContract.checkIn();
        
        checkInBtn.innerText = "Verifying...";
        checkInBtn.disabled = true;
        
        await tx.wait();
        
        statusText.innerText = "Streak Updated!";
        await loadUserData();
        await loadLeaderboard();
        
    } catch (error) {
        console.error(error);
        if (error.reason && error.reason.includes("Come back tomorrow")) {
             statusText.innerText = "Cooldown Active";
        } else {
            statusText.innerText = "Transaction Failed";
        }
        checkInBtn.disabled = false;
        checkInBtn.innerHTML = "Claim Daily Check-In <div class='btn-glow'></div>";
    }
}

connectBtn.addEventListener("click", connectWallet);
checkInBtn.addEventListener("click", handleCheckIn);
