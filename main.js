
function gold_span(value, precision=0) {
    value = (+value.toFixed(precision));

    return "<span class='gold_indicator'>" + value + "<img src='gold20.png'></span>";
}

function time_span(time) {
    var minutes = Math.floor(time / 60);
    var second = time % 60;
    var time_string = minutes + ':' + Math.floor(second / 10) + '' + (second % 10);

    return "<span class='time_indicator'>" + time_string + "</span>";
}

function close_button_html(item_idx) {
    return "<div class='remove_button_holder'><button class='remove_button' onclick='build.delete_by_idx(" + item_idx + "); render_all()'>x</button></div>";
}

function get_lasthit_quality_value() {
    var v = document.getElementById('lasthit_quality_selector').value / 100.0;

    if (Number.isNaN(v)) v = 1;
    if (v > 1) v = 1;
    if (v < 0) v = 0;

    return v;
}

class LeagueItem {
    constructor (id, name, cost) {
        this.id = id;
        this.name = name;
        this.cost = cost;
    }

    image_url() {
        return "http://ddragon.leagueoflegends.com/cdn/" + LEAGUE_VERSION + "/img/item/" + this.id + ".png";
    }

    shop_div() {
        var div = document.createElement("div");
        div.classList.add("league_shop_item");
        div.title = this.name;
        div.value = this.id;
        div.onclick = function(){
            var item = itemset.by_id(this.value);
            build.push(item); 
            render_all();
        };

        div.innerHTML = "<img width=64 height=64 src='" + this.image_url() + "'> <br> " + gold_span(this.cost);

        return div;
    }

    build_div(gold_available, item_idx) {
        var div = document.createElement("div");
        var avail_text = "---";
        div.classList.add("league_build_item");

        if (gold_available >= this.cost) {
            div.classList.add("item_available");
            avail_text = "<span class='item_available_label'>Available</span>";
        } else {
            div.classList.add("item_not_available");
            avail_text = "<span class='item_not_available_label'>Need " + gold_span(this.cost - gold_available) + " more</span>";
        }

        div.innerHTML = 
            "<img style='float: left; margin-right: 10px; ' width=64 height=64 src='" + this.image_url() + "'> " +
            close_button_html(item_idx) + 
            this.name + "<br>" + 
            gold_span(this.cost) + "<br>" +
            avail_text;

        return div;
    }
}

class LeagueItemSet {
    constructor () {

    }

    from_json(items_json) {
        this.json = items_json;

        this._by_id = {};
        this.items = [];

        for (var item_id in this.json.data) {
            var item = new LeagueItem(
                item_id,
                this.json.data[item_id].name,
                this.json.data[item_id].gold.total
            )

            this.items.push(item);
            this._by_id[item_id] = item;
        }

        this.sort_by_cost();
    }

    sort_by_name() {
        this.items.sort(function(a, b) {
            if (a.name < b.name) return -1;
            if (a.name > b.name) return 1;
            
            return 0;
        });
    }

    sort_by_cost() {
        this.items.sort(function(a, b) {
            if (a.cost < b.cost) return -1;
            if (a.cost > b.cost) return 1;
            
            if (a.name < b.name) return -1;
            if (a.name > b.name) return 1;
            
            return 0;
        });
    }

    by_id(item_id) {
        return this._by_id[item_id];
    }

    render() {
        var container = document.getElementById("shop_items_container");

        var sort_by = document.getElementById('sort_selector').value;
        if (sort_by == 'cost') this.sort_by_cost();
        if (sort_by == 'name') this.sort_by_name();

        var filter_str = document.getElementById('filter_selector').value.toLowerCase().trim();

        container.innerHTML = '';
        for (var i in this.items) {
            var item = this.items[i];

            if (item.cost == 0) continue;
            if (item.name.toLowerCase().indexOf(filter_str) == -1) continue;

            container.appendChild(item.shop_div());
        }
    }
};

class LeagueBuild {
    constructor () {
        this.items = [];

        this.update_completely_available();
    }

    update_completely_available() {
        var champion = document.getElementById('champion_selector').value;
        var line = document.getElementById('line_selector').value;
        var lasthit_quality = get_lasthit_quality_value();

        this.complete_build_model = new LeagueIncomeModel(MAX_TIME, this.total_cost, champion, lasthit_quality, line);
    }

    push(item) {
        if (this.items.length >= 6) return;

        this.items.push(item);

        console.log(this.items);

        this.update_completely_available();
    }

    delete_by_idx(idx) {
        this.items.splice(idx, 1);

        this.update_completely_available();
    }

    get total_cost() {
        var sum_cost = 0;
        
        for (var i in this.items) {
            var item = this.items[i];

            sum_cost += item.cost;
        }

        return sum_cost;
    }

    render() {
        var items_count_label = document.getElementById('build_items_count_label');
        var items_cost_label = document.getElementById('build_items_cost_label');
        var items_time_label = document.getElementById('build_items_time_label');
        var sum_cost = 0;

        var container = document.getElementById("build_items_container");
        container.innerHTML = '';
        
        for (var i in this.items) {
            var item = this.items[i];

            container.appendChild(item.build_div(stats_table.model.total_gold - sum_cost, i));
            
            sum_cost += item.cost;
        }

        items_count_label.innerHTML = this.items.length;
        items_cost_label.innerHTML = gold_span(sum_cost);
        items_time_label.innerHTML = time_span(this.complete_build_model.current_time);
    }

}

class LeagueIncomeModel {
    constructor (cap_time, cap_gold, champion, lasthit_quality, line) {
        this.cap_time = cap_time;
        this.cap_gold = cap_gold;
        this.champion = champion;
        this.line = line;
        this.lasthit_quality = lasthit_quality;
        
        this.rift_passive_income_per_second = 20.4 / 10;
        this.rift_passive_income_start_time = 1*60 + 50;

        // retired in patch 13.12
        this.early_game_duration = 14*60;
        this.early_game_midline_penalty_per_minion = 0; 
        this.early_game_midline_lasthits = 0;

        this.current_time = 0;
        this.current_passive_income_per_second = 0;
        this.starting_gold = 500;

        this.melee_lasthits = 0;
        this.caster_lasthits = 0;
        this.siege_lasthits = 0;

        this.melee_bounty_per_one = 21;
        this.caster_bounty_per_one = 14;
        this.siege_total_bounty = 0;

        this.melee_per_wave = 3;
        this.caster_per_wave = 3;
    
        this.first_wave_timing = 1*60 + 5;
        this.wave_period = 30;

        this.loaded_dice_average_bounty = 0;
        if (this.champion == "tf") this.loaded_dice_average_bounty = 3.5;

        this.compute();

        console.log(this.current_time, this.total_gold);
    }

    get rift_passive_income_seconds() {
        return Math.max(0, this.current_time - this.rift_passive_income_start_time);
    }

    get passive_profit() {
        return this.rift_passive_income_seconds * this.rift_passive_income_per_second;
    }

    get total_gold() {
        return this.starting_gold +
            this.passive_profit +
            this.lane_minion_total_bounty + 
            this.loaded_dice_total_bounty;
    }

    get lane_minion_lasthits() {
        return this.melee_lasthits +
            this.caster_lasthits + 
            this.siege_lasthits;
    }

    get lane_minion_total_bounty() {
        return this.melee_total_bounty +
            this.caster_total_bounty +
            this.siege_total_bounty;
    }

    get melee_total_bounty() {
        return this.melee_lasthits * this.melee_bounty_per_one;
    }

    get caster_total_bounty() {
        return this.caster_lasthits * this.caster_bounty_per_one;
    }

    get loaded_dice_total_bounty() {
        return this.loaded_dice_average_bounty * this.lane_minion_lasthits;
    }

    get early_game_midline_total_penalty() {
        return this.early_game_midline_lasthits * this.early_game_midline_penalty_per_minion;
    }

    get total_gold() {
        return this.starting_gold +
            this.passive_profit +
            this.lane_minion_total_bounty + 
            this.loaded_dice_total_bounty +
            this.early_game_midline_total_penalty;
    }

    siege_minion_spawns_at(time) {
        if (time < 15*60 && (time % 90) == ((2*60+5)%90) ) return true;
        if (time > 15*60 && time < 25*60 && time % 60 == 5) return true;
        if (time > 25*60 && time % 30 == 5) return true;
    
        return false;
    }
    
    siege_minion_gold_bounty_at(time) {
        var base = 60;
        var upgrade = 3 * Math.floor(Math.max(0, time - (2*60+5)) / 90);
        upgrade = Math.min(30, upgrade);
    
        return base + upgrade;
    }

    passively_wait(closest_event_time) {
        var passive_gold_left = this.cap_gold - this.total_gold;
        var passive_income_period = Math.min(
            this.cap_time - this.current_time,
            closest_event_time - this.current_time,
            Math.ceil(passive_gold_left / this.current_passive_income_per_second)
        );

        if (this.current_time >= this.cap_time) return true;
        if (this.total_gold >= this.cap_gold) return true;
        if (this.current_time >= closest_event_time) return false;

        this.current_time += passive_income_period;
        
        if (this.current_time < closest_event_time) return true;
        
        return false;
    }

    compute() {
        console.log(this.cap_time, this.cap_gold, this.champion, this.line);
    
        if (this.total_gold > this.cap_gold) return;

        for (var wave_time = this.first_wave_timing; true; wave_time += this.wave_period) {
            // wait income
            if (this.current_time < this.rift_passive_income_start_time && this.rift_passive_income_start_time < wave_time) {

                if (this.passively_wait(this.rift_passive_income_start_time)) return;
                this.current_passive_income_per_second = this.rift_passive_income_per_second;
            }

            // wait wave
            if (this.passively_wait(wave_time)) return;
            
            console.log(this.current_time, wave_time, this.cap_time, this.total_gold, this.siege_minion_spawns_at(wave_time));
            
            // get minion wave
            this.melee_lasthits  += this.melee_per_wave  * this.lasthit_quality;
            this.caster_lasthits += this.caster_per_wave * this.lasthit_quality;

            if (this.siege_minion_spawns_at(wave_time)) {
                this.siege_lasthits += 1 * this.lasthit_quality;
                this.siege_total_bounty += this.siege_minion_gold_bounty_at(wave_time) * this.lasthit_quality;
            }
   
            if (this.line == "mid" && wave_time < this.early_game_duration) {
                this.early_game_midline_lasthits = this.lane_minion_lasthits;
            }

            if (this.total_gold >= this.cap_gold) return;
        }
    }
    
}

class LeagueStatsTable {
    constructor () {
        this.current_time = 20*60 + 0;
    }

    set_time(time) {
        if (Number.isNaN(time)) time = 0;
        if (time > MAX_TIME) time = MAX_TIME;
        if (time < 0) time = 0;

        this.current_time = time;
    }

    update_time() {
        var min = Number.parseInt(document.getElementById('stattable_min').value);
        var sec = Number.parseInt(document.getElementById('stattable_sec').value);
        
        if (Number.isNaN(min)) min = 0;
        if (Number.isNaN(sec)) sec = 0;

        this.set_time(min*60 + sec);
    }

    table_starting_gold(model) {
        return "<tr>" +
            "<td>Starting gold</td>" +
            "<td></td>" +
            "<td>" + gold_span(model.starting_gold) +"</td>" + 
            "</tr>";
    }

    table_row_passive_income(model) {
        return "<tr>" +
            "<td>Passive income</td>" +
            "<td>" + time_span(model.rift_passive_income_seconds) + " x " + gold_span(model.rift_passive_income_per_second, 2)  + "</td>" +
            "<td>" + gold_span(model.passive_profit) +"</td>" + 
            "</tr>";
    }

    table_row_lasthit_quality(model) {
        var color_red = Math.round(255 * Math.min(1, 2-2*model.lasthit_quality));
        var color_green = Math.round(255 * Math.min(1, 2*model.lasthit_quality));

        return "<tr>" +
            "<td>Lasthit quality</td>" +
            "<td style='color: rgb(" + color_red + ", " + color_green + ", 0);'>" + (100 * model.lasthit_quality).toFixed(1) + "% " + "</td>" +
            "<td>" + "</td>" + 
            "</tr>";
    }

    table_row_minions_melee(model) {
        return "<tr>" +
            "<td>Melee minions lasthits</td>" +
            "<td>" + model.melee_lasthits.toFixed(1) + " x " + gold_span(model.melee_bounty_per_one)  + "</td>" +
            "<td>" + gold_span(model.melee_total_bounty) +"</td>" + 
            "</tr>";
    }

    table_row_minions_caster(model) {
        return "<tr>" +
            "<td>Caster minions lasthits</td>" +
            "<td>" + model.caster_lasthits.toFixed(1) + " x " + gold_span(model.caster_bounty_per_one)  + "</td>" +
            "<td>" + gold_span(model.caster_total_bounty) +"</td>" + 
            "</tr>";
    }

    table_row_minions_siege(model) {
        return "<tr>" +
            "<td>Siege minions lasthits</td>" +
            "<td>" + model.siege_lasthits.toFixed(1) + "</td>" +
            "<td>" + gold_span(model.siege_total_bounty) +"</td>" + 
            "</tr>";
    }

    table_row_minions_all(model) {
        return "<tr>" +
            "<td>All minions lasthits</td>" +
            "<td>" + model.lane_minion_lasthits.toFixed(1) + "</td>" +
            "<td>" + gold_span(model.lane_minion_total_bounty) +"</td>" + 
            "</tr>";
    }

    table_row_loaded_dice(model) {
        return "<tr>" +
            "<td>Loaded dice (passive)</td>" +
            "<td>" + model.lane_minion_lasthits.toFixed(1) + " x " + gold_span(model.loaded_dice_average_bounty, 1)  + "</td>" +
            "<td>" + gold_span(model.loaded_dice_total_bounty) +"</td>" + 
            "</tr>";
    }

    table_row_early_game_midline_penalty(model) {
        return "<tr>" +
            "<td>Early game midline penalty</td>" +
            "<td>" + model.early_game_midline_lasthits.toFixed(1) + " x " + gold_span(model.early_game_midline_penalty_per_minion, 0)  + "</td>" +
            "<td>" + gold_span(model.early_game_midline_total_penalty) +"</td>" + 
            "</tr>";
    }

    table_row_sum(model) {
        return "<tr>" +
            "<td>Total</td>" +
            "<td></td>" +
            "<td>" + gold_span(model.total_gold) +"</td>" + 
            "</tr>";
    }

    table_row_separator(model) {
        return "<tr><td class='separator_tr' colspan=3><colspan></tr>";
    }

    table_row_header(model) {
        return "<tr><th>Source</th><th>Amount</th><th>Total</th></tr>";
    }

    render() {
        var table = document.getElementById('stattable');
        var time_label = document.getElementById('stattable_time_label');

        var champion = document.getElementById('champion_selector').value;
        var line = document.getElementById('line_selector').value;
        var lasthit_quality = get_lasthit_quality_value();
        var model = new LeagueIncomeModel(this.current_time, MAX_GOLD, champion, lasthit_quality, line);

        console.log(model);

        table.innerHTML = '';

        table.innerHTML += this.table_row_header(model);

        table.innerHTML += this.table_row_separator(model);
        
        table.innerHTML += this.table_starting_gold(model);
        table.innerHTML += this.table_row_passive_income(model);

        table.innerHTML += this.table_row_separator(model);
        
        table.innerHTML += this.table_row_lasthit_quality(model);
        table.innerHTML += this.table_row_minions_melee(model);
        table.innerHTML += this.table_row_minions_caster(model);
        table.innerHTML += this.table_row_minions_siege(model);
        table.innerHTML += this.table_row_minions_all(model);
    
        table.innerHTML += this.table_row_separator(model);

        // retired in patch 13.12
        //if (line == "mid") {table.innerHTML += this.table_row_early_game_midline_penalty(model);}
        
        if (champion == 'tf') {
            table.innerHTML += this.table_row_loaded_dice(model);
        }

        table.innerHTML += this.table_row_separator(model);
        
        table.innerHTML += this.table_row_sum(model);
        
        time_label.innerHTML = time_span(model.current_time);

        this.model = model;
    }
}

var LEAGUE_VERSION = "14.5.1";
var LAST_UPDATED = "6 March 2023";
var MAX_GOLD = 150 * 1000;
var MAX_TIME = 240 * 60;
var itemset = new LeagueItemSet();
var build = new LeagueBuild();
var stats_table = new LeagueStatsTable();

function render_all() {
    stats_table.render();
    itemset.render();
    build.render();
}

fetch("https://ddragon.leagueoflegends.com/cdn/" + LEAGUE_VERSION + "/data/en_US/item.json")
    .then(response => response.json())
    .then(items_json => {
        // filter items for Summoner's Rift
        const SUMMONERS_RIFT_MAP_ID = 11;
        var summoners_rift_items_data = {};
        for (var item_id in items_json.data) {
            var item = items_json.data[item_id];
            if (item.maps[SUMMONERS_RIFT_MAP_ID]) {
                summoners_rift_items_data[item_id] = item;
            }
        };
        items_json.data = summoners_rift_items_data;

        // prepare and render
        itemset.from_json(items_json);
        
        render_all();
        
        console.log(itemset);
    });

document.getElementById('general_info_label').innerHTML = 
    "League of Legends solo lane farming calculator. " + 
    "Last updated at <span style='color: #00ff00;'>" + LAST_UPDATED + "</span>. " + 
    "Consistent with game version <span style='color: #00ff00;'>" + LEAGUE_VERSION + "</span>";
