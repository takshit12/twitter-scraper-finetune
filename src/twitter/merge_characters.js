import TwitterPipeline from './TwitterPipeline.js';
import Logger from './Logger.js';
import inquirer from 'inquirer';
import chalk from 'chalk';

// Get arguments directly from process.argv
const [,, newCharacter, character1, character2] = process.argv;

async function promptForMergeOptions(sourceAccounts, availableTweets) {
  const answers = await inquirer.prompt([
    {
      type: 'number',
      name: 'tweetsPerAccount',
      message: 'How many top tweets to include from each account?',
      default: 50,
      validate: (value) => {
        if (value <= 0) return 'Please enter a positive number';
        const maxTweets = Math.min(...availableTweets);
        if (value > maxTweets) return `Maximum available tweets is ${maxTweets}`;
        return true;
      }
    },
    {
      type: 'confirm',
      name: 'filterRetweets',
      message: 'Exclude retweets?',
      default: true
    },
    {
      type: 'list',
      name: 'sortBy',
      message: 'How should tweets be ranked?',
      choices: [
        { name: 'Total engagement (likes + retweets)', value: 'total' },
        { name: 'Likes only', value: 'likes' },
        { name: 'Retweets only', value: 'retweets' },
        { name: 'Most recent', value: 'date' }
      ]
    },
    {
      type: 'confirm',
      name: 'reviewSample',
      message: 'Would you like to review a sample of selected tweets before merging?',
      default: true
    }
  ]);

  return answers;
}

async function displayTweetSample(tweets, sourceAccounts) {
  console.log('\n📝 Sample of Selected Tweets:\n');
  
  for (const account of sourceAccounts) {
    const accountTweets = tweets.filter(t => t.username === account);
    if (accountTweets.length === 0) continue;

    console.log(chalk.cyan(`\n@${account}'s Top Tweets:`));
    accountTweets.slice(0, 3).forEach((tweet, i) => {
      console.log(chalk.white(`\n${i + 1}. ${tweet.text}`));
      console.log(chalk.gray(`❤️ ${tweet.likes} | 🔄 ${tweet.retweetCount} | 📅 ${new Date(tweet.timestamp).toLocaleDateString()}`));
    });
  }

  const { proceed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'proceed',
      message: 'Proceed with merging these tweets?',
      default: true
    }
  ]);

  return proceed;
}

async function main() {
  const sourceAccounts = [character1, character2];

  if (!newCharacter || sourceAccounts.length < 2) {
    Logger.error("Usage: node merge_characters.js <new_name> <account1> <account2>");
    Logger.info("Example: node merge_characters.js alfacito cryptocito alfaketchum");
    process.exit(1);
  }

  try {
    const pipeline = new TwitterPipeline(newCharacter);
    
    // Get available tweet counts for each account
    const availableTweets = await Promise.all(sourceAccounts.map(async (account) => {
      try {
        const tweets = await pipeline.getTweetsForAccount(account);
        return tweets.length;
      } catch (error) {
        Logger.warn(`Could not get tweet count for @${account}: ${error.message}`);
        return 0;
      }
    }));

    // Show available tweets per account
    console.log('\n📊 Available Tweets:');
    sourceAccounts.forEach((account, i) => {
      console.log(chalk.cyan(`@${account}: ${availableTweets[i]} tweets`));
    });

    // Get merge options
    const options = await promptForMergeOptions(sourceAccounts, availableTweets);
    
    // Create merged character with options
    const mergedTweets = await pipeline.createMergedCharacter(sourceAccounts, {
      tweetsPerAccount: options.tweetsPerAccount,
      filterRetweets: options.filterRetweets,
      sortBy: options.sortBy
    });

    // Show sample if requested
    if (options.reviewSample) {
      const proceed = await displayTweetSample(mergedTweets, sourceAccounts);
      if (!proceed) {
        Logger.info('Merge cancelled by user');
        process.exit(0);
      }
    }

    Logger.success('✨ Character merge completed successfully!');

  } catch (error) {
    Logger.error(`Failed to create merged character: ${error.message}`);
    process.exit(1);
  }
}

main(); 
