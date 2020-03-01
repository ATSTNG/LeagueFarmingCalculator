
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

    render(filter) {
        var container = document.getElementById("shop_items_container");
        container.innerHTML = '';

        for (var i in this.items) {
            var item = this.items[i];

            container.appendChild(item.shop_div());
        }
    }
};

class LeagueBuild {
    constructor () {
        this.items = [];
    }

    push(item) {
        if (this.items.length >= 6) return;

        this.items.push(item);

        console.log(this.items);
    }

    delete_by_idx(idx) {
        this.items.splice(idx, 1);
    }

    get total_cost() {
        var sum_cost = 0;

        for (var i in this.items) {
            var item = this.items[i];
            
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

            container.appendChild(item.build_div(4000 - sum_cost, i));
            
            sum_cost += item.cost;
        }

        items_count_label.innerHTML = this.items.length;
        items_cost_label.innerHTML = gold_span(sum_cost);
        items_time_label.innerHTML = time_span(123);
    }

}

class LeagueIncomeModel {
    constructor (cap_time, cap_gold, champion) {
        this.MAX_TIME = 180*60 + 0;
        this.MAX_GOLD = 100*1000;

        this.cap_time = cap_time;
        this.cap_gold = cap_gold;
        this.champion = champion;
        
        this.rift_passive_income_per_second = 20.4 / 10;
        this.rift_passive_income_start_time = 1*60 + 50;

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
    }

    get rift_passive_income_seconds() {
        return Math.max(0, this.time - this.rift_passive_income_start_time);
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

    get total_gold() {
        return this.starting_gold +
            this.passive_profit +
            this.lane_minion_total_bounty + 
            this.loaded_dice_total_bounty;
    }

    siege_minion_spawns_at(time) {
        if (time < 15*60 && time % 90 == (2*60+5)%90 ) return true;
        if (time < 25*60 && time % 60 == 5) return true;
        if (time > 25*60 && time % 30 == 5) return true;
    
        return false;
    }
    
    siege_minion_gold_bounty_at(time) {
        var base = 60;
        var upgrade = 3 * Math.floor(Math.max(0, time - (2*60+15)) / 90);
        upgrade = Math.min(30, upgrade);
    
        return base + upgrade;
    }

    passively_wait(cap_time, cap_gold, closest_event_time) {
        var passive_gold_left = cap_gold - this.total_gold;
        var passive_income_period = Math.min(
            Math.ceil(passive_gold_left / this.current_passive_income_per_second), 
            cap_time - this.time,
            closest_event_time - this.time
        );
        
        if (passive_income_period < 0) return true;

        this.time += passive_income_period;
        
        if (this.time < closest_event_time) return true;
        
        return false;
    }

    compute() {
        console.log(this.cap_time, this.cap_gold, this.champion);
    
        if (this.total_gold > cap_gold) return;

        for (var wave_time = this.first_wave_timing; wave_time < cap_time; wave_time += this.wave_period) {
            // wait
            if (this.current_time < this.rift_passive_income_start_time && this.rift_passive_income_start_time < wave_time) {

            }
            
            // minion wave
            this.melee_lasthits += this.melee_per_wave;
            this.caster_lasthits += this.caster_per_wave;
    
            if (this.siege_minion_spawns_at(wave_time)) {
                this.siege_lasthits += 1;
                this.siege_total_bounty += this.siege_minion_gold_bounty_at(wave_time);
            }
    
            if (this.total_gold >= cap_gold) return;
    
            // passive income after wave
            var next_wave_time = wave_time + this.wave_period;
            if (this.passively_wait(next_wave_time)) return;

            
            
        }
    }
    
}

class LeagueStatsTable {
    constructor () {
        this.current_time = 8*60 + 0;

    }

    set_time(time) {
        if (time > this.MAX_TIME) time = this.MAX_TIME;
        if (time < 0) time = 0;

        this.current_time = time;
    }
    
    model_compute(cap_time, cap_gold, champion) {
        console.log(cap_time, cap_gold, champion);

        cap_time = Math.min(cap_time, this.MAX_TIME);

        var model = {};
        model.time = 0;
        model.total_gold = 0;
        
        // starting gold
        model.starting_gold = 500;

        // passive income
        model.passive_income_per_second = 20.4 / 10;
        model.passive_income_start_time = 1*60 + 50;

        model.passive_income_seconds = 0;
        model.passive_profit = 0;

        // minions
        model.lane_minion_lasthits = 0;
        model.lane_minion_total_bounty = 0;
        
        model.melee_lasthits = 0;
        model.caster_lasthits = 0;
        model.siege_lasthits = 0;
        
        model.melee_bounty_per_one = 21;
        model.caster_bounty_per_one = 14;

        model.melee_total_bounty = 0;
        model.caster_total_bounty = 0;
        model.siege_total_bounty = 0;

        model.melee_per_wave = 3;
        model.caster_per_wave = 3;

        model.first_wave_timing = 1*60 + 5;
        model.wave_period = 30;

        // tf
        model.loaded_dice_average_bounty = 0;
        if (champion == "tf") model.loaded_dice_average_bounty = 3.5;
        model.loaded_dice_total_bounty = 0;

        // simulate
        model.time = 0;
        model.total_gold = model.starting_gold;

        if (model.total_gold < cap_gold && model.passive_income_start_time < cap_time) {
            model.time = model.passive_income_start_time;
        }

        if (model.total_gold < cap_gold) {
            var passive_gold_left = cap_gold - model.total_gold;
            var passive_income_period = Math.min(
                Math.ceil(passive_gold_left / model.passive_income_per_second), 
                cap_time - model.time,
                model.first_wave_timing - model.time
            );

            model.time += passive_income_period;
            model.passive_income_seconds += passive_income_period;
            model.passive_profit = model.passive_income_seconds * model.passive_income_per_second;

            model.lane_minion_lasthits = 
                model.melee_lasthits +
                model.caster_lasthits + 
                model.siege_lasthits;
            model.lane_minion_total_bounty = 
                model.melee_total_bounty +
                model.caster_total_bounty + 
                model.siege_total_bounty;
            model.loaded_dice_total_bounty = 
                model.loaded_dice_average_bounty * model.lane_minion_lasthits;

            model.total_gold = 
                model.starting_gold +
                model.passive_profit +
                model.lane_minion_total_bounty + 
                model.loaded_dice_total_bounty;
        }

        if (model.time < model.first_wave_timing) return model;

        for (var wave_time = model.first_wave_timing; wave_time < cap_time; wave_time += model.wave_period) {
            var siege_minion_spawns_this_wave = this.siege_minion_spawns_at(wave_time);
            console.log(wave_time, siege_minion_spawns_this_wave);

            // minion wave
            model.melee_lasthits += model.melee_per_wave;
            model.caster_lasthits += model.caster_per_wave;

            if (this.siege_minion_spawns_at(wave_time)) {
                model.siege_lasthits += 1;
                model.siege_total_bounty += this.siege_minion_gold_bounty_at(wave_time);
            }


            model.melee_total_bounty = model.melee_lasthits * model.melee_bounty_per_one;
            model.caster_total_bounty = model.caster_lasthits * model.caster_bounty_per_one;

            model.lane_minion_lasthits = 
                model.melee_lasthits +
                model.caster_lasthits + 
                model.siege_lasthits;
            model.lane_minion_total_bounty = 
                model.melee_total_bounty +
                model.caster_total_bounty + 
                model.siege_total_bounty;
            model.loaded_dice_total_bounty = 
                model.loaded_dice_average_bounty * model.lane_minion_lasthits;
                
            model.total_gold = 
                model.starting_gold +
                model.passive_profit +
                model.lane_minion_total_bounty + 
                model.loaded_dice_total_bounty;

            if (model.total_gold >= cap_gold) return model;

            // passive income after wave
            var next_wave_time = wave_time + model.wave_period;
            var passive_gold_left = cap_gold - model.total_gold;
            var passive_income_period = Math.min(
                Math.ceil(passive_gold_left / model.passive_income_per_second), 
                cap_time - model.time,
                next_wave_time - model.time
            );

            model.time += passive_income_period;
            model.passive_income_seconds += passive_income_period;
            model.passive_profit = model.passive_income_seconds * model.passive_income_per_second;

            model.total_gold = 
                model.starting_gold +
                model.passive_profit +
                model.lane_minion_total_bounty + 
                model.loaded_dice_total_bounty;
            
            if (model.time < next_wave_time) return model;
            
        }

        return model;
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
            "<td>" + time_span(model.passive_income_seconds) + " x " + gold_span(model.passive_income_per_second, 2)  + "</td>" +
            "<td>" + gold_span(model.passive_profit) +"</td>" + 
            "</tr>";
    }

    table_row_minions_melee(model) {
        return "<tr>" +
            "<td>Melee minions lasthits</td>" +
            "<td>" + model.melee_lasthits + " x " + gold_span(model.melee_bounty_per_one)  + "</td>" +
            "<td>" + gold_span(model.melee_total_bounty) +"</td>" + 
            "</tr>";
    }

    table_row_minions_caster(model) {
        return "<tr>" +
            "<td>Caster minions lasthits</td>" +
            "<td>" + model.caster_lasthits + " x " + gold_span(model.caster_bounty_per_one)  + "</td>" +
            "<td>" + gold_span(model.caster_total_bounty) +"</td>" + 
            "</tr>";
    }

    table_row_minions_siege(model) {
        return "<tr>" +
            "<td>Siege minions lasthits</td>" +
            "<td>" + model.siege_lasthits + "</td>" +
            "<td>" + gold_span(model.siege_total_bounty) +"</td>" + 
            "</tr>";
    }

    table_row_minions_all(model) {
        return "<tr>" +
            "<td>All minions lasthits</td>" +
            "<td>" + model.lane_minion_lasthits + "</td>" +
            "<td>" + gold_span(model.lane_minion_total_bounty) +"</td>" + 
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
        var model = this.model_compute(this.current_time, this.MAX_GOLD, champion);

        console.log(model);

        table.innerHTML = '';

        table.innerHTML += this.table_row_header(model);

        table.innerHTML += this.table_row_separator(model);
        
        table.innerHTML += this.table_starting_gold(model);
        table.innerHTML += this.table_row_passive_income(model);

        table.innerHTML += this.table_row_separator(model);
        
        table.innerHTML += this.table_row_minions_melee(model);
        table.innerHTML += this.table_row_minions_caster(model);
        table.innerHTML += this.table_row_minions_siege(model);
        table.innerHTML += this.table_row_minions_all(model);
    
        table.innerHTML += this.table_row_separator(model);
        
        table.innerHTML += this.table_row_sum(model);
        
        time_label.innerHTML = time_span(model.time);
    }
}

var LEAGUE_VERSION = "10.4.1";
var itemset = new LeagueItemSet();
var build = new LeagueBuild();
var stats_table = new LeagueStatsTable();

function render_all() {
    itemset.render();
    build.render();
    stats_table.render();
}

fetch("http://ddragon.leagueoflegends.com/cdn/" + LEAGUE_VERSION + "/data/en_US/item.json")
    .then(response => response.json())
    .then(items_json => {
        itemset.from_json(items_json);
        
        render_all();
        
        console.log(itemset);
    });


