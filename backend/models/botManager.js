const botNames = [
    // Rajasthan based Indian female names (50+)
    'Neha Jaipur', 'Tanvi Jodhpur', 'Meera Ajmer', 'Nisha Bhiwadi',
    'Priya Udaipur', 'Riya Kota', 'Anjali Bikaner', 'Sneha Jaipur',
    'Kavya Jodhpur', 'Pooja Ajmer', 'Divya Bhiwadi', 'Ritu Udaipur',
    'Sakshi Kota', 'Manisha Bikaner', 'Deepika Jaipur', 'Isha Jodhpur',
    'Aarti Ajmer', 'Shilpa Bhiwadi', 'Kajal Udaipur', 'Nidhi Kota',
    'Rashmi Bikaner', 'Anita Jaipur', 'Madhu Jodhpur', 'Geeta Ajmer',
    'Suman Bhiwadi', 'Rekha Udaipur', 'Sharda Kota', 'Santosh Bikaner',
    'Kamla Jaipur', 'Vimla Jodhpur', 'Mamta Ajmer', 'Saroj Bhiwadi',
    'Usha Udaipur', 'Prabha Kota', 'Sarita Bikaner', 'Ganga Jaipur',
    'Yamuna Jodhpur', 'Gauri Ajmer', 'Durga Bhiwadi', 'Laxmi Udaipur',
    'Saraswati Kota', 'Parvati Bikaner', 'Kali Jaipur', 'Tara Jodhpur',
    'Sita Ajmer', 'Radha Bhiwadi', 'Shakti Udaipur', 'Aditi Kota',
    'Ananya Bikaner', 'Shreya Jaipur', 'Ishita Jodhpur', 'Tanaya Ajmer',
    'Riddhi Bhiwadi', 'Saanvi Udaipur', 'Aadhya Kota', 'Anvi Bikaner',
    'Diya Jaipur', 'Myra Jodhpur', 'Aanya Ajmer', 'Ira Bhiwadi'
];

const getBotName = () => {
    return botNames[Math.floor(Math.random() * botNames.length)];
};

const getBotLevel = (playerStats) => {
    // playerStats: { gamesPlayed, wins, losses, currentLevel }
    // Levels: 0=easy, 1=medium, 2=hard, 3=hard+, 4=legendary
    if (!playerStats || playerStats.gamesPlayed === 0) return 0;

    const ratio = playerStats.wins / playerStats.gamesPlayed;
    
    // If win rate > 80% and played more than 5 games, increase level
    if (ratio > 0.8 && playerStats.gamesPlayed > 5) {
        return Math.min(playerStats.currentLevel + 1, 4);
    }
    // If win rate < 30%, decrease level
    if (ratio < 0.3 && playerStats.currentLevel > 0) {
        return playerStats.currentLevel - 1;
    }
    // Otherwise stay
    return playerStats.currentLevel || 0;
};

const getBotSmartness = (level) => {
    // level 0: easy (60% best, 40% random)
    // level 1: medium (75% best, 25% random)
    // level 2: hard (90% best, 10% random)
    // level 3: hard+ (95% best, 5% random)
    // level 4: legendary (99% best, 1% random)
    const percentages = [0.6, 0.75, 0.9, 0.95, 0.99];
    return percentages[level] || 0.6;
};

module.exports = { getBotName, getBotLevel, getBotSmartness };