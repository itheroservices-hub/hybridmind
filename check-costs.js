#!/usr/bin/env node
/**
 * 🚨 COST MONITORING TOOL
 * Run this to check your daily API spending
 */

const axios = require('axios');

async function checkCosts() {
  console.log('💰 HybridMind Cost Monitor');
  console.log('='.repeat(50));
  
  try {
    const response = await axios.get('http://localhost:3000/cost-stats');
    const data = response.data.data;
    
    console.log(`\n📊 Daily Budget: $${data.dailyBudget}`);
    console.log(`✅ Spent Today: $${data.dailySpent}`);
    console.log(`💵 Remaining:   $${data.dailyRemaining}`);
    console.log(`📈 Used:        ${data.percentUsed}%`);
    console.log(`📧 Requests:    ${data.requestsToday} today, ${data.requestsLastHour} last hour`);
    console.log(`⏰ Resets in:   ${data.resetsIn}`);
    
    if (data.warning) {
      console.log(`\n${data.warning}`);
    }
    
    // Visual bar
    const barLength = 30;
    const filled = Math.floor((data.percentUsed / 100) * barLength);
    const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);
    console.log(`\n[${bar}] ${data.percentUsed}%`);
    
    // Warnings
    if (parseFloat(data.percentUsed) > 80) {
      console.log('\n⚠️  WARNING: Approaching daily budget limit!');
      console.log('   Consider using free models only:');
      console.log('   - meta-llama/llama-3.3-70b-instruct (FREE)');
    } else if (parseFloat(data.percentUsed) > 50) {
      console.log('\n⚡ You\'ve used more than half your daily budget.');
    } else {
      console.log('\n✅ Budget looking good! Keep using responsibly.');
    }
    
    console.log('\n' + '='.repeat(50));
    
  } catch (error) {
    console.error('\n❌ Error checking costs:', error.message);
    console.error('   Make sure the server is running on http://localhost:3000');
    process.exit(1);
  }
}

checkCosts();
