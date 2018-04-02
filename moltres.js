/*
 * Custom raid bot for Valor of Boston.
 */
'use strict';

const Discord = require('discord.js');
const mysql = require('mysql');
const config = require('./config.js');

const moltres = new Discord.Client();

moltres.on('ready', () => {
  console.log(`Logged in as ${moltres.user.tag}.`);
});

const conn = mysql.createConnection({
  host: 'localhost',
  user: 'moltres',
  password: config.moltresdb,
  database: 'moltresdb',
  supportBigNumbers: true,
  bigNumberStrings: true,
});

conn.connect(function(err) {
  if (err) {
    console.error(`Error connecting to moltresdb: ${err.stack}`);
    process.exit(1);
  }
  console.log(`Connected as id ${conn.threadId}.`);
});

///////////////////////////////////////////////////////////////////////////////

function cleanup() {
  moltres.destroy();
  conn.end();
}

function signal_handler(signal) {
  cleanup();
  process.exit(128 + signal);
}

process.on('exit', cleanup);
process.on('uncaughtException', cleanup);
process.on('SIGINT', signal_handler);
process.on('SIGHUP', signal_handler);
process.on('SIGTERM', signal_handler);
process.on('SIGABRT', signal_handler);

///////////////////////////////////////////////////////////////////////////////

const Permission = {
  ADMIN: 0,
  NONE: 1,
  TABLE: 2,
};

/*
 * Order of display for $help.
 */
const cmd_order = [
  'help', 'set-perm', 'test',
  'gym', 'ls-gyms', 'add-gym',
  'raid', 'ls-raids', 'egg', 'boss', 'update',
  'call-time', 'join', // 'unjoin',
];

const cmds = {
  'help': {
    perms: Permission.NONE,
    usage: '[request]',
    args: [0, 1],
    desc: 'Learn about our team\'s legendary avatar.',
    detail: [
      'Just `$help` will list all common requests. You can also use',
      '`$help req` or `$req help` to get more information about a specific',
      'request.',
    ],
  },
  'set-perm': {
    perms: Permission.TABLE,
    usage: '<user> <request>',
    args: [2, 2],
    desc: 'Enable others to use more requests.',
    detail: [
      'The user should be identified by tag.',
    ],
  },
  'test': {
    perms: Permission.ADMIN,
    usage: '',
    args: [0, 100],
    desc: 'Flavor of the week testing command.',
    detail: [
      'This request is only available to me.',
    ],
  },
  'gym': {
    perms: Permission.NONE,
    usage: '<handle>',
    args: [1, 1],
    desc: 'Get information about a gym.',
    detail: [
      'A gym handle is something like `jh-john-harvard` or `newtowne`.',
      'You can use partial substring matches (like `jh` or even `ohn-harv`)',
      'as long as they don\'t match another gym.\n\nUse `$ls-gyms <region>`',
      'if you want to see all the gym handles (but they should be what you',
      'expect).',
    ],
  },
  'ls-gyms': {
    perms: Permission.NONE,
    usage: '<region-name>',
    args: [1, 100],
    desc: 'List all gyms in a region.',
    detail: [
      'The region name should be any valid region role (without the `@`).',
      'Case doesn\'t matter, and uniquely-identifying prefixes are allowed,',
      'so, e.g., `harvard` will work, but `boston` will not (but `boston',
      'common` is fine).',
    ],
  },
  'add-gym': {
    perms: Permission.TABLE,
    usage: '<handle> <region> <lat> <lng> <name>',
    args: [5, 100],
    desc: 'Add a new gym to the database.',
    detail: [
      'The region can be a tag, a numeric Discord ID, or a prefix of the',
      'region role name. If a prefix is used, it cannot contain whitespace,',
      'which means that roles with shared prefixes _must_ be identified by',
      'tag (which _can_ contain whitespace) or by ID.\n\nThe recommended',
      'method for adding gyms is to copy information over from',
      '<http://www.massmwcreaturemap.com/>. Note that the latitude argument',
      'is allowed to contain a trailing comma, for ease of copying.',
    ],
  },
  'raid': {
    perms: Permission.NONE,
    usage: '<gym-handle>',
    args: [1, 1],
    desc: 'Get information about the current raid at a gym.',
    detail: [
      'See `$help gym` for details on gym handles.',
    ],
  },
  'ls-raids': {
    perms: Permission.NONE,
    usage: '<region-name>',
    args: [1, 100],
    desc: 'List all active raids in a region.',
    detail: [
      'The region name should be any valid region role (without the `@`).',
      'Case doesn\'t matter, and uniquely-identifying prefixes are allowed,',
      'so, e.g., `harvard` will work, but `boston` will not (but `boston',
      'common` is fine).',
    ],
  },
  'egg': {
    perms: Permission.NONE,
    usage: '<gym-handle> <tier> <time-til-hatch MM:SS>',
    args: [3, 3],
    desc: 'Report a raid egg.',
    detail: [
      'The tier can be any number 1–5 or things like `t3` or `T4`. The time',
      'should be the current _**countdown timer**_, not a time of day. See',
      '`$help gym` for details on gym handles.',
    ],
  },
  'boss': {
    perms: Permission.NONE,
    usage: '<gym-handle> <boss> <time-til-despawn MM:SS>',
    args: [3, 3],
    desc: 'Report a hatched raid boss.',
    detail: [
      'The time should be the current _**countdown timer**_, not a time of',
      'day. See `$help gym` for details on gym handles.',
    ],
  },
  'update': {
    perms: Permission.NONE,
    usage: '<gym-handle> <tier-or-boss-or-despawn-time>',
    args: [2, 2],
    desc: 'Modify an active raid listing.',
    detail: [
      'Note that unlike `$egg` and `$boss`, times are interpreted as',
      '_despawn times_, not countdown timers.',
    ],
  },
  'call-time': {
    perms: Permission.NONE,
    usage: '<gym-handle> <HH:MM> [num-extras]',
    args: [2, 3],
    desc: 'Call a time for a raid.',
    detail: [
      'Make sure not to double-call a time, or Moltres will be mad at you.',
    ],
  },
  'join': {
    perms: Permission.NONE,
    usage: '<gym-handle> [HH:MM] [num-extras]',
    args: [1, 3],
    desc: 'Join a called raid time.',
    detail: [
      'You don\'t need to specify the time _unless_ the raid has multiple',
      'called times, in which case you do.',
    ],
  },
  /*
  'unjoin': {
    perms: Permission.NONE,
    usage: '<gym-handle> [HH:MM] [num-extras]',
    args: [1, 3],
    desc: 'Back out of a raid.',
  },
  */
};

const cmd_aliases = {
  'gyms':         'ls-gyms',
  'raids':        'ls-raids',
  'spot-egg':     'egg',
  'spot-raid':    'boss',
  'update-raid':  'update',
};

const raid_tiers = {
  snorunt: 1,
  swablu: 1,
  wailmer: 1,
  magikarp: 1,

  manectric: 2,
  mawile: 2,
  sableye: 2,
  electabuzz: 2,
  exeggutor: 2,

  piloswine: 3,
  jolteon: 3,
  jynx: 3,
  gengar: 3,
  machamp: 3,

  absol: 4,
  aggron: 4,
  tyranitar: 4,
  golem: 4,

  lugia: 5,
};

///////////////////////////////////////////////////////////////////////////////
// Discord utilities.

/*
 * Wrapper around send() that swallows exceptions.
 */
function send_quiet(channel, content) {
  return channel.send(content).catch(console.error);
}

/*
 * Re-load a message for performing further operations.
 */
function refresh(msg) {
  return msg.channel.fetchMessage(msg.id);
}

/*
 * Avoid polluting the rest of the file with emoji.
 */
const emoji_by_name = {
  cry: '😢',
  no_entry_sign: '🚫',
  no_good: '🙅',
  thinking: '🤔',
};

/*
 * Get a custom emoji by name.
 */
function get_emoji(name) {
  return moltres.emojis.find('name', name);
}

/*
 * Add reactions to `msg' in order.
 */
function chain_reaccs(msg, ...reaccs) {
  if (reaccs.length === 0) return;
  let [head, ...tail] = reaccs;

  let emoji = emoji_by_name[head] || get_emoji(head);
  let promise = msg.react(emoji);

  for (let name of tail) {
    let emoji = emoji_by_name[name] || get_emoji(name);
    promise = promise.then(r => r.message.react(emoji));
  }
  promise.catch(console.error);
}

/*
 * Get a Role by `name' for the guild `msg' belongs to.
 */
function get_role(msg, name) {
  let role = msg.guild.roles.find('name', name);
  if (role) return role;

  let matches = msg.guild.roles.filterArray(
    role => role.name.toLowerCase().startsWith(name.toLowerCase())
  );
  return matches.length === 1 ? matches[0] : null;
}

/*
 * Count all the mentions in `msg'.
 */
function total_mentions(msg) {
  return msg.mentions.channels.size +
         msg.mentions.members.size +
         msg.mentions.roles.size +
         msg.mentions.users.size +
         msg.mentions.everyone;
}

/*
 * Log base function.
 */
function log_impl(msg, str, reacc) {
  if (str !== null) {
    let log = moltres.channels.get(config.log_id);
    send_quiet(log, str);
  }
  if (reacc !== null) chain_reaccs(msg, reacc);
};

/*
 * Log a successful request, an invalid request, or an internal error.
 */
function log_success(msg, str, reacc = null) {
  log_impl(msg, str, reacc);
};
function react_success(msg, reacc = null) {
  log_impl(msg, null, reacc || 'approved');
};
function log_error(msg, str, reacc = null) {
  log_impl(msg, str, reacc || 'no_good');
};
function log_invalid(msg, str, keep = false) {
  log_impl(msg, str, null);

  msg.author.createDM()
    .then(dm => dm.send(str))
    .catch(console.error);

  if (!keep) {
    msg.delete().catch(console.error);
  }
};

/*
 * Get the usage string for `cmd'.
 */
function usage_string(cmd) {
  if (!(cmd in cmds)) return null;
  return `Usage: \`\$${cmd} ${cmds[cmd].usage}\`

${cmds[cmd].detail.join(' ')}

Arguments in \`<>\` are required; arguments in \`[]\` are optional.`;
}

///////////////////////////////////////////////////////////////////////////////
// MySQL utilities.

/*
 * MySQL handler which logs any error, or otherwise delegates to a callback.
 */
function errwrap(msg, fn = null) {
  return function (err, ...rest) {
    if (err) {
      console.error(err);
      return log_error(msg, `MySQL error: ${err.code}.`);
    }
    if (fn !== null) {
      refresh(msg)
        .then(m => fn(m, ...rest))
        .catch(console.error);
    }
  };
}

/*
 * Wrapper around common handling for mutation requests.
 */
function mutation_handler(msg, failure = null, success = null) {
  return errwrap(msg, function (msg, result) {
    /*
     * The `result' for a mutation has the following structure:
     *
     * OkPacket {
     *   fieldCount: 0,
     *   affectedRows: 1,
     *   insertId: 23,
     *   serverStatus: 34,
     *   warningCount: 0,
     *   message: '&Records: 1  Duplicates: 0  Warnings: 0',
     *   protocol41: true,
     *   changedRows: 0,
     * }
     */
    if (result.affectedRows === 0) {
      if (failure !== null) failure(msg, result);
    } else {
      if (success !== null) {
        success(msg, result);
      } else {
        react_success(msg);
      }
    }
  })
}

/*
 * SQL snippet of the common "only one gym match" WHERE expression.
 */
const where_one_gym =
  ' (SELECT COUNT(*) FROM gyms WHERE gyms.handle LIKE ?) = 1 ';

///////////////////////////////////////////////////////////////////////////////
// Time utilities.

/*
 * Return a Date for the current time.
 */
function get_now() {
  return new Date(Date.now());
}

/*
 * Extract the minutes and seconds from a raid countdown timer.
 */
function parse_timer(timer) {
  let matches = timer.match(/^(\d{1,2}):(\d\d)$/);
  if (matches === null) return null;

  let [_, mins, secs] = matches;
  if (secs >= 60) return null;

  return { mins: parseInt(mins), secs: parseInt(secs) };
}

/*
 * Parse a time given by HH:MM as a Date object.
 *
 * This function uses rough heuristics to determine whether the user meant A.M.
 * or P.M., based on the assumption that the intent is always to represent the
 * most proximal time in the future.
 */
function parse_hour_minute(time) {
  let matches = time.match(/^(\d{1,2}):(\d\d)$/);
  if (matches === null) return null;

  let [_, hours, mins] = matches;
  if (hours >= 24 || mins >= 60) return null;

  let now = get_now();

  hours = function() {
    // 24-hour time; let the user use exactly that time.
    if (hours >= 13) return hours;
    // Same or later morning hour.
    if (hours >= now.getHours()) return hours;
    // Same or later afternoon hour if we interpret as P.M.
    if (hours + 12 >= now.getHours()) return hours + 12;

    return hours;
  }();

  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    hours,
    mins
  );
}

/*
 * Stringify a Date object according to our whims.
 */
function time_str(date) {
  return date.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: 'numeric',
    hour12: true,
  });
}

/*
 * Get the raid pop or hatch time from a despawn time.
 */
function pop_from_despawn(despawn) {
  let pop = new Date(despawn.getTime());
  pop.setMinutes(pop.getMinutes() - 60 - 45);
  return pop;
}
function hatch_from_despawn(despawn) {
  let hatch = new Date(despawn.getTime());
  hatch.setMinutes(hatch.getMinutes() - 45);
  return hatch;
}

///////////////////////////////////////////////////////////////////////////////
// General handlers.

function handle_help(msg, args) {
  let out = null;

  if (args.length === 0) {
    out = get_emoji('valor') +
          '  Please choose your request from the following:\n\n';
    for (let cmd of cmd_order) {
      out += `\`\$${cmd}\`:  ${cmds[cmd].desc}\n`;
    }
  } else {
    let [cmd] = args;
    out = `\`${cmd}\`:  ${cmds[cmd].desc}\n${usage_string(cmd)}`;
  }
  send_quiet(msg.channel, out.trim());
}

function handle_set_perm(msg, args) {
  let [user_tag, request] = args;

  if (!user_tag.match(Discord.MessageMentions.USERS_PATTERN) ||
      msg.mentions.users.size !== 1) {
    return log_invalid(msg, `Invalid user tag \`${user_tag}\`.`);
  }
  let user_id = msg.mentions.users.first().id;

  conn.query(
    'INSERT INTO permissions SET ?',
    { cmd: request,
      user_id: user_id, },
    mutation_handler(msg)
  );
}

function handle_test(msg, args) {
  chain_reaccs(msg, 'cry', 'no_good', 'approved', 'RaidEgg');
}

///////////////////////////////////////////////////////////////////////////////
// Gym handlers.

/*
 * Helper for error-handling cases where zero or multiple gyms are found.
 *
 * Returns true if we have a single result, else false.
 */
function check_one_gym(msg, handle, results) {
  if (results.length < 1) {
    chain_reaccs(msg, 'cry');
    send_quiet(msg.channel, `No unique gym match found for \`${handle}\`.`);
    return false;
  } else if (results.length > 1) {
    log_invalid(msg, `Multiple gyms matching \`${handle}\`.`);
    return false;
  }
  return true;
}

/*
 * Stringify a row from the gyms table.
 */
function gym_row_to_string(msg, gym) {
  return `\`[${gym.handle}]\`
name: **${gym.name}**
region: ${msg.guild.roles.get(gym.region).name}
coords: <https://maps.google.com/maps?q=${gym.lat},${gym.lng}>`;
}

function handle_gym(msg, args) {
  let [handle] = args;
  handle = handle.toLowerCase();

  conn.query(
    'SELECT * FROM gyms WHERE handle LIKE ?',
    [`%${handle}%`],

    errwrap(msg, function (msg, results) {
      if (!check_one_gym(msg, handle, results)) return;
      let [gym] = results;

      msg.channel.send(gym_row_to_string(msg, gym))
        .then(m => log_success(msg, `Handled \`gym\` from ${msg.author.tag}.`))
        .catch(console.error);
    })
  );
}

function handle_ls_gyms(msg, args) {
  let role_name = args.join(' ');
  let role = get_role(msg, role_name);
  if (role === null) {
    return log_invalid(msg, `Invalid region name \`${role_name}\`.`);
  }

  conn.query(
    'SELECT * FROM gyms WHERE region = ?', [role.id],

    errwrap(msg, function (msg, results) {
      if (results.length === 0) {
        return chain_reaccs(msg, 'no_entry_sign');
      }

      let output = `Gyms in **${role.name}**:\n`;
      for (let gym of results) {
        output += `\n\`[${gym.handle}]\` ${gym.name}`;
      }
      send_quiet(msg.channel, output);
    })
  );
}

function handle_add_gym(msg, args) {
  let [handle, region_in, lat, lng, ...name] = args;
  handle = handle.toLowerCase();

  if (lat.charAt(lat.length - 1) === ',') {
    lat = lat.substr(0, lat.length - 1);
  }

  let region = function() {
    // Maybe it's a mention.
    if (region_in.match(Discord.MessageMentions.ROLES_PATTERN) &&
        msg.mentions.roles.size === 1) {
      return msg.mentions.roles.first().id;
    }

    // Maybe it's a prefix.
    let region = get_role(msg, region_in);
    if (region) return region.id;

    // Maybe it's an ID.
    region = msg.guild.roles.get(region_in);
    return region ? region.id : null;
  }();
  if (region === null) {
    return log_invalid(msg, `Invalid region \`${region_in}\`.`);
  }

  name = name.join(' ');

  conn.query(
    'INSERT INTO gyms SET ?',
    { handle: handle,
      name: name,
      region: region,
      lat: lat,
      lng: lng, },
    mutation_handler(msg)
  );
}

///////////////////////////////////////////////////////////////////////////////
// Raid handlers.

/*
 * Pull the integer tier from a tier string (e.g., '5' or 'T5'), or return null
 * if the string is not tier-like.
 */
function parse_tier(tier) {
  tier = '' + tier;

  if (tier.startsWith('T') || tier.startsWith('t')) {
    tier = tier.substr(1);
  }
  tier = parseInt(tier);
  return (tier >= 1 && tier <= 5) ? tier : null;
}

/*
 * Capitalize the first letter of a raid boss's name, or return 'unknown' if
 * the boss is null.
 */
function fmt_boss(boss) {
  return boss !== null
    ? boss.charAt(0).toUpperCase() + boss.substr(1)
    : 'unknown';
}

function handle_raid(msg, args) {
  let [handle] = args;
  handle = handle.toLowerCase();

  let now = get_now();

  conn.query({
    sql:
      'SELECT * FROM gyms ' +
      '   INNER JOIN raids ON gyms.id = raids.gym_id ' +
      '   LEFT JOIN calls ON raids.gym_id = calls.raid_id ' +
      '   LEFT JOIN rsvps ON calls.id = rsvps.call_id ' +
      '   WHERE gyms.handle LIKE ? AND ' + where_one_gym,
    values: [`%${handle}%`, `%${handle}%`],
    nestTables: true,
  }, errwrap(msg, function (msg, results) {
    if (results.length < 1) {
      chain_reaccs(msg, 'no_entry_sign');
      return send_quiet(msg.channel, `No unique raid found for ${handle}.`);
    }
    let [{gyms, raids, calls}] = results;

    if (raids.despawn < now) {
      // Clean up expired raids.
      conn.query(
        'DELETE FROM raids WHERE gym_id = ?',
        [raids.gym_id],
        errwrap(msg)
      );
      return chain_reaccs(msg, 'no_entry_sign', 'RaidEgg');
    }

    let hatch = hatch_from_despawn(raids.despawn);

    let output = gym_row_to_string(msg, gyms) + '\n';
    if (now >= hatch) {
      output +=`
raid: **${fmt_boss(raids.boss)}** (T${raids.tier})
despawn: ${time_str(raids.despawn)}`;
    } else {
      output +=`
raid egg: **T${raids.tier}**
hatch: ${time_str(hatch)}`;
    }

    if (calls.time !== null) {
      output += '\n\ncall times:';

      let times = [];
      let rows_by_time = {};

      // Order and de-dup the call times and bucket rows by those times.
      for (let row of results) {
        let t = row.calls.time.getTime();
        if (t < now) continue;

        if (!(t in rows_by_time)) {
          times.push(t);
          rows_by_time[t] = [];
        }
        rows_by_time[t].push(row);
      }
      times.sort();

      // Append details for each call time.
      for (let t of times) {
        let [{calls}] = rows_by_time[t];

        // Get an array of attendee strings, removing the raid time caller.
        let attendees = rows_by_time[t].map(row => {
          let member = msg.guild.members.get(row.rsvps.user_id);
          if (!member || member.user.id === calls.caller) return null;

          let extras = row.rsvps.extras !== 0
            ? ` +${row.rsvps.extras}`
            : '';
          return `${member.nickname || member.user.username}${extras}`
        }).filter(a => a !== null);

        let caller = msg.guild.members.get(calls.caller);
        let caller_str = caller
          ? caller.nickname || caller.user.username
          : '';

        output += `\n- **${time_str(calls.time)}**—` +
                  `${caller_str}${attendees.length !== 0 ? ', with: ' : ''}` +
                  `${attendees.join(', ')}`;
      }
    }

    msg.channel.send(output)
      .then(m => log_success(msg, `Handled \`raid\` from ${msg.author.tag}.`))
      .catch(console.error);
  }));
}

function handle_ls_raids(msg, args) {
  let role_name = args.join(' ');
  let role = get_role(msg, role_name);
  if (role === null) {
    return log_invalid(msg, `Invalid region name \`${role_name}\`.`);
  }

  let now = get_now();

  conn.query(
    'SELECT * FROM gyms INNER JOIN raids ' +
    'ON gyms.id = raids.gym_id ' +
    'WHERE gyms.region = ? AND raids.despawn > ?',
    [role.id, now],

    errwrap(msg, function (msg, results) {
      if (results.length === 0) {
        return chain_reaccs(msg, 'no_entry_sign', 'RaidEgg');
      }

      let output = `Active raids in **${role.name}**:\n`;
      for (let raid of results) {
        let hatch = hatch_from_despawn(raid.despawn);
        let boss = hatch > now ? 'egg' : fmt_boss(raid.boss);
        let timer_str = hatch > now
          ? `hatches at ${time_str(hatch)}`
          : `despawns at ${time_str(raid.despawn)}`

        output +=
          `\n\`[${raid.handle}]\` **T${raid.tier} ${boss}** ${timer_str}`;
      }
      send_quiet(msg.channel, output);
    })
  );
}

function handle_report(msg, handle, tier_in, boss, timer_in) {
  handle = handle.toLowerCase();

  let tier = parse_tier(tier_in);
  if (tier === null) {
    return log_invalid(msg, `Invalid raid tier \`${tier_in}\`.`);
  }

  let timer = parse_timer(timer_in);
  if (timer === null) {
    return log_invalid(msg, `Invalid MM:SS timer \`${timer_in}\`.`);
  }

  let egg_adjust = boss === null ? 45 : 0;

  let despawn = get_now();
  despawn.setMinutes(despawn.getMinutes() + timer.mins + egg_adjust);
  despawn.setSeconds(despawn.getSeconds() + timer.secs);

  let pop = pop_from_despawn(despawn);

  conn.query(
    'REPLACE INTO raids (gym_id, tier, boss, despawn, spotter) ' +
    '   SELECT gyms.id, ?, ?, ?, ? FROM gyms ' +
    '   WHERE ' +
    '     gyms.handle LIKE ? ' +
    '   AND ' +
    '     NOT EXISTS ( ' +
    '       SELECT * FROM raids ' +
    '         WHERE gym_id = gyms.id ' +
    '         AND despawn > ? ' +
    '     ) ' +
    '   AND ' + where_one_gym,
    [tier, boss, despawn, msg.author.id, `%${handle}%`, pop, `%${handle}%`],

    mutation_handler(msg, function (msg, result) {
      log_invalid(msg,
        `No unique gym match found for \`${handle}\` that doesn't already ` +
        'have an active raid.'
      );
    })
  );
}

function handle_egg(msg, args) {
  let [handle, tier, timer] = args;

  handle_report(msg, handle, tier, null, timer);
}

function handle_boss(msg, args) {
  let [handle, boss, timer] = args;
  boss = boss.toLowerCase();

  if (!(boss in raid_tiers)) {
    return log_invalid(msg, `Unrecognized raid boss \`${boss}\`.`);
  }

  handle_report(msg, handle, raid_tiers[boss], boss, timer);
}

function handle_update(msg, args) {
  let [handle, data] = args;
  handle = handle.toLowerCase();

  let assignment = function() {
    let boss = data.toLowerCase();
    if (boss in raid_tiers) {
      return {
        tier: raid_tiers[boss],
        boss: boss,
      };
    }

    let now = get_now();
    let despawn = parse_hour_minute(data);
    if (despawn !== null && despawn > now &&
        pop_from_despawn(despawn) <= now) {
      return { despawn: despawn };
    }

    let tier = parse_tier(data);
    if (tier !== null) {
      return { tier: tier };
    }

    return null;
  }();

  if (assignment === null) {
    return log_invalid(msg, `Invalid update parameter \`${data}\`.`);
  }

  conn.query(
    'UPDATE raids INNER JOIN gyms ON raids.gym_id = gyms.id ' +
    'SET ? WHERE gyms.handle LIKE ? AND ' + where_one_gym,
    [assignment, `%${handle}%`, `%${handle}%`],

    mutation_handler(msg, function (msg, result) {
      log_invalid(msg,
        `No unique gym match found for \`${handle}\` with an active raid.`
      );
    })
  );
}

///////////////////////////////////////////////////////////////////////////////
// Raid call handlers.

function handle_call_time(msg, args) {
  let [handle, time, extras] = args;
  handle = handle.toLowerCase();

  let call_time = parse_hour_minute(time);
  if (call_time === null) {
    return log_invalid(msg, `Unrecognized HH:MM time \`${time}\`.`);
  }

  let now = get_now();
  if (call_time < now) {
    return log_invalid(msg, `Can't call a time in the past \`${time}\`.`);
  }

  extras = extras || 0;

  let later = new Date(call_time.getTime());
  later.setMinutes(later.getMinutes() + 45);

  conn.query(
    'INSERT INTO calls (raid_id, caller, time) ' +
    '   SELECT raids.gym_id, ?, ? FROM gyms INNER JOIN raids ' +
    '     ON gyms.id = raids.gym_id ' +
    '   WHERE gyms.handle LIKE ? ' +
    '     AND raids.despawn > ? ' +
    '     AND raids.despawn <= ? ' +
    '     AND ' + where_one_gym,
    [msg.author.id, call_time, `%${handle}%`, call_time, later, `%${handle}%`],

    mutation_handler(msg, function (msg, result) {
      log_invalid(msg,
        `Could not find a unique raid for \`${handle}\` with call time ` +
        `\`${time_str(call_time)}\` after hatch and before despawn ` +
        `(or this time has already been called).`
      );
    }, function (msg, result) {
      let call_id = result.insertId;

      conn.query(
        'INSERT INTO rsvps SET ?',
        { call_id: call_id,
          user_id: msg.author.id,
          extras: extras,
          maybe: false },
        errwrap(msg)
      );

      // Grab the raid information just for reply purposes.
      conn.query(
        'SELECT * FROM gyms INNER JOIN raids ON gyms.id = raids.gym_id ' +
        '   WHERE handle LIKE ?',
        [`%${handle}%`],

        errwrap(msg, function (msg, results) {
          if (!check_one_gym(msg, handle, results)) return;
          let [raid] = results;

          let role = msg.guild.roles.get(raid.region);
          if (!role) {
            return log_error(msg, `Malformed gym entry for ${raid.handle}.`);
          }

          let role_str = raid.silent ? role.name : role.toString();

          let output =
            `${role_str} **T${raid.tier} ${fmt_boss(raid.boss)}** raid ` +
            `at \`[${raid.handle}]\` ` +
            `called for ${time_str(call_time)} by ${msg.author}\n\n` +
            `To join this raid time, enter \`$join ${raid.handle}\`.`;
          send_quiet(msg.channel, output);
        })
      );
    })
  );
}

function handle_join(msg, args) {
  let [handle, time, extras] = args;
  handle = handle.toLowerCase();

  let call_time = null;
  if (time) {
    call_time = parse_hour_minute(time);
    if (call_time === null) {
      return log_invalid(msg, `Unrecognized HH:MM time \`${time}\`.`);
    }
  }

  extras = extras || 0;

  conn.query(
    'INSERT INTO rsvps (call_id, user_id, extras, maybe) ' +
    '   SELECT calls.id, ?, ?, ? ' +
    '     FROM gyms ' +
    '       INNER JOIN raids ON gyms.id = raids.gym_id ' +
    '       INNER JOIN calls ON raids.gym_id = calls.raid_id ' +
    '   WHERE gyms.handle LIKE ? ' +
    '     AND ' + where_one_gym +
    '     AND ' + (call_time === null
      ? '   (SELECT COUNT(*) FROM calls ' +
        '     WHERE raids.gym_id = calls.raid_id) = 1'
      : '   calls.time = ?'
    ),
    [msg.author.id, extras, false, `%${handle}%`, `%${handle}%`, call_time],

    mutation_handler(msg, function (msg, result) {
      log_invalid(msg,
        `Could not find a unique, active raid for \`${handle}\`` +
        (call_time !== null
          ? ` with called time \`${time_str(call_time)}\`.`
          : '.')
      );
    })
  );
}

function handle_unjoin(msg, args) {
}

///////////////////////////////////////////////////////////////////////////////

/*
 * Do the work of `request'.
 */
function handle_request(msg, request, args) {
  if (args.length === 1 && args[0] === 'help') {
    return handle_help(msg, [request]);
  }

  let params_range = cmds[request].args;

  if (args.length < params_range[0] || args.length > params_range[1]) {
    return log_invalid(msg, usage_string(request));
  }

  switch (request) {
    case 'help':      return handle_help(msg, args);
    case 'set-perm':  return handle_set_perm(msg, args);
    case 'test':      return handle_test(msg, args);

    case 'gym':       return handle_gym(msg, args);
    case 'ls-gyms':   return handle_ls_gyms(msg, args);
    case 'add-gym':   return handle_add_gym(msg, args);

    case 'raid':      return handle_raid(msg, args);
    case 'ls-raids':  return handle_ls_raids(msg, args);
    case 'egg':       return handle_egg(msg, args);
    case 'boss':      return handle_boss(msg, args);
    case 'update':    return handle_update(msg, args);

    case 'call-time': return handle_call_time(msg, args);
    case 'join':      return handle_join(msg, args);
    case 'unjoin':    return handle_unjoin(msg, args);
    default:
      return log_invalid(msg, `Invalid request \`${request}\`.`);
  }
}

/*
 * Check whether the user who sent `msg' has the proper permissions to make
 * `request', and make it if so.
 */
function handle_request_with_check(msg, request, args) {
  let user_id = msg.author.id;

  request = cmd_aliases[request] || request;

  if (!(request in cmds)) {
    return log_invalid(msg, `Invalid request \`${request}\`.`);
  }

  if (config.admin_ids.has(user_id) ||
      cmds[request].perms === Permission.NONE) {
    return handle_request(msg, request, args);
  }

  conn.query(
    'SELECT * FROM permissions WHERE (cmd = ? AND user_id = ?)',
    [request, user_id],

    errwrap(msg, function (msg, results) {
      if (results.length === 1) {
        return handle_request(msg, request, args);
      }

      return log_invalid(
        msg,
        `User ${msg.author.tag} does not have permissions for ${request}.`,
        'dealwithit'
      );
    })
  );
}

/*
 * Process a user request.
 */
function process_request(msg) {
  if (msg.content.charAt(0) !== '$') return;
  let [request, ...rest] = msg.content.substr(1).split(/\s+/);

  handle_request_with_check(msg, request, rest);
}

///////////////////////////////////////////////////////////////////////////////

/*
 * Main reader event.
 */
moltres.on('message', msg => {
  if (config.channels.has(msg.channel.id)) {
    try {
      process_request(msg);
    } catch (e) {
      console.error(e);
    }
  }
});

moltres.login(config.moltres);
