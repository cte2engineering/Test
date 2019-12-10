/**
 * Copyright 2019 Sam Maksimovich
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 * 
 * ## LinePlot Module
 * - Given a list of pairs, we create a lineplot of these pairs
 * - To draw a lineplot we need to render:
 *   * Filled circles at each point (toggleable)
 *   * Lines to connect these circles
 *   * Labeled Axes and grid lines
 *   * Numbers/Units
 *   * Title
 *   * Shaded area under the curve
 * - Each of these components should be toggleable, to customize a scatterplot
 * - We render these components using d3.js, SVG and text
 * - We expect our data to be formatted as such:
 *   * `data = List [x1, y1, x2, y2, ..., x_n, y_n]`
 *
 * Example Usage:
 * ```
 * // Prepare your data
 * let data = [];
 * let f = (x) => Math.sqrt(x) * Math.pow(Math.E, Math.cos(x));
 * let num = 10;
 * for (let x = 0; x <= num; x++) {
 *   data.push(x);
 *   data.push(f(data[data.length - 1]));
 * }
 *
 * // Create your Lineplot
 * let lineplot = new LinePlot("#lineplot", data);
 *
 * // Customize it
 * lineplot.set_goal(10);
 * lineplot.set_y_label("Distance ran (miles)");
 * lineplot.set_title("Your Running Progress");
 * lineplot.set_x_label("Time, months");
 * ```
 * 
 * @class LinePlot
 */
class LinePlot {
    
    /**
     * Creates an instance of LinePlot.
     * @param {String} container_id - id of the HTML element to render the plot
     * @param {List} data - lineplot data
     * @memberof LinePlot
     */
    constructor(container_id, data) {
        this.container = d3.select(container_id);

        // Automatic width and height
        this.min_width = 300;
        this.min_height = 300;
        let bounds = this.container.node().getBoundingClientRect();
        this.width = (bounds.width == 0) ? this.min_width : bounds.width;
        this.height = (bounds.height == 0) ? this.min_height : bounds.height;

        this.data = [];
        for (let i = 0; i + 1 < data.length; i += 2)
            this.data.push({x: data[i], y: data[i + 1]});
        
        // No data points, just center grid on (0, 0)
        if (this.data.length == 0)
            this.data.push({x: 0, y: 0});

        this.padding = {left: 0.03, top: 0.05, right: 0.04, bottom: 0.15};
        this.show_dots = false;
        this.dot_color = "rgb(255, 99, 71)";
        this.dot_radius = 5;
        this.dot_stroke = "white";
        
        this.show_grid_lines = false;
        this.show_line = true;
        this.show_shaded_area = true;
        this.fill_color = "rgba(255, 163, 88, 0.25)";
        this.line_stroke = "rgb(255, 163, 88)";
        this.font_height = 12;
        this.text_padding = 6;

        this.title_text = "Your Weight Loss Progress";
        this.x_label_text = "Time (days)";
        this.y_label_text = "Weight (lbs)";

        this.show_goal = false;
        this.goal = 5;
        this.goal_text_padding = 8;
        
        // Private variables
        this._data_x_range = [this.data[0].x, this.data[0].x];
        this._data_y_range = [this.data[0].y, this.data[0].y];

        this._init();
    }

    /**
     * Updates the html element to render the plot
     */
    _init() {
        //////////////////////////////////////////
        // Create Axes Labels and Title
        //////////////////////////////////////////
        
        let table = this.container.append("table")
            .style("margin", "0 auto");
        let row1 = table.append("tr");
        let row2 = table.append("tr");
        let row3 = table.append("tr");

        row1.append("td");
        this.title = row1.append("td")
            .style("vertical-align", "middle")
            .style("text-align", "left")
            .style("font-weight", "bold")
            .style("font-size", "30px")
            .style("padding",  "10px")
            .text(this.title_text);    

        this.y_label = row2.append("td")
            .style("vertical-align", "middle")
            .style("text-align", "center")
            .style("font-size", "14px")
            .style("max-width", "70px")
            .style("padding", "5px")
            .text(this.y_label_text);    
            
        let y_label_width = this.y_label.node().getBoundingClientRect().width;
        this.width -= y_label_width;

        this.svg = row2.append("td")
            .append("svg")
            .attr("width", "100%")
            .attr("viewBox", `0 0 ${this.width} ${this.height}`);
            
        row3.append("td");
        this.x_label = row3.append("td")
            .style("vertical-align", "middle")
            .style("text-align", "center")
            .style("font-size", "14px")
            .style("width", "100%")
            .text(this.x_label_text);    

        //////////////////////////////////////////
        // Compute pre-requistes, intervals of the data
        //////////////////////////////////////////

        let find_element = (list, comparator, key) => {
            let element = list[0];
            for (let e of list)
                if (comparator(key(e), key(element)))
                    element = e;
            return key(element);
        };

        let less_than = (x1, x2) => x1 < x2;
        let greater_than = (x1, x2) => x1 > x2;
        
        this._data_x_range = [
            find_element(this.data, less_than, (pair) => pair.x),
            find_element(this.data, greater_than, (pair) => pair.x) 
        ]; // in other words x_range = [min, max] of data.x
        
        // This is the actual x_range of the plot which we render
        let plot_x_range = this._data_x_range.slice(0);
        plot_x_range[0] -= this.padding.left * (this._data_x_range[1] - this._data_x_range[0]);
        plot_x_range[1] += this.padding.right * (this._data_x_range[1] - this._data_x_range[0]);

        this.x = d3.scaleLinear()
            .domain(plot_x_range)
            .range([0, this.width]);

        ///////////// Y Intervals Below

        this._data_y_range = [
            find_element(this.data, less_than, (pair) => pair.y),
            find_element(this.data, greater_than, (pair) => pair.y) 
        ]; // in other words y_range = [min, max] of data.y

        let plot_y_range = this._data_y_range.slice(0);
        plot_y_range[0] -= this.padding.bottom * (this._data_y_range[1] - this._data_y_range[0]);
        plot_y_range[1] += this.padding.top * (this._data_y_range[1] - this._data_y_range[0]);
    
        this.y = d3.scaleLinear()
            .domain(plot_y_range)
            .range([this.height, 0]);

        //////////////////////////////////////////
        // Draw Grid Lines as well as units of measurement
        //////////////////////////////////////////
        
        this._draw_axes();

        //////////////////////////////////////////
        // Draw the dots and connect them
        //////////////////////////////////////////

        let path_string = `M ${this.x(this.data[0].x)} ${this.y(this.data[0].y)}`;
        for (let i = 1; i < this.data.length; i++) 
            path_string += `L ${this.x(this.data[i].x)} ${this.y(this.data[i].y)} `;
        
        if (this.show_line) 
            this.line = this.svg.append("path")
                .attr("d", path_string)
                .attr("fill", "transparent")
                .attr("stroke", this.line_stroke)
                .attr("stroke-linecap", "round")
                .attr("stroke-width", 2)
        
        if (this.show_shaded_area) {
            path_string += ` L ${this.x(this.data[this.data.length - 1].x)} ${this.y(0)}`;
            path_string += ` L ${this.x(this.data[0].x)} ${this.y(0)} Z`;
        
            this.shaded_area = this.svg.append("path")
                .attr("d", path_string)
                .attr("fill", this.fill_color)
        }

        if (this.show_dots) {
            this.dots = this.svg.selectAll("circle")
                .data(this.data)
                .enter().append("circle")
                .attr("cx", (d) => this.x(d.x))
                .attr("cy", (d) => this.y(d.y))
                .attr("r", this.dot_radius)
                .attr("stroke", this.dot_stroke)
                .attr("stroke-width", 2)
                .style("fill", this.line_stroke);
        }

        //////////////////////////////////////////
        // Draw the goal weight indicator
        //////////////////////////////////////////

        if (this.show_goal) {
            this.goal_text = this.svg.append("text")
                .attr("x", this.x(0) + this.goal_text_padding)
                .attr("y", this.y(this.goal))
                .style("font-size", "14px")
                .attr("dominant-baseline", "middle")
                .text("Goal");
            
            let goal_text_width = this.goal_text.node().getBBox().width;
            path_string = `M ${this.x(0) + goal_text_width + 2 * this.goal_text_padding} 
                ${this.y(this.goal)} L ${this.width} ${this.y(this.goal)}`;
            
            this.goal_indicator = this.svg.append("path")
                .attr("d", path_string)
                .attr("fill", "transparent")
                .attr("stroke", "rgb(255, 136, 38)")
                .attr("stroke-linecap", "round")
                .attr("stroke-width", 2)
                .attr("stroke-dasharray", "10, 10");
        }
    }

    set_goal(goal) {
        if (!this.show_goal)
            return;

        this.goal = goal;
        if (!this.goal_text || !this.goal_indicator)
            return new_val;

        this._update_y();
        this._update_graph();
    }

    /**
     * Updates the plot to correctly fit y-values of the points and goal indicator
     */
    _update_y() {
        if (this.data.length == 0)
            this.data.push({x: 0, y: 0});

        this._data_y_range = [0, this.data[0].y];
        for (let i = 0; i < this.data.length; i++) {
            if (this.data[i].y > this._data_y_range[1])
                this._data_y_range[1] = this.data[i].y;
            if (this.data[i].y < this._data_y_range[0])
                this._data_y_range[0] = this.data[i].y;
        }

        let plot_y_range = this._data_y_range.slice(0);
        if (this.goal > plot_y_range[1])
            plot_y_range[1] = this.goal;
        if (this.goal < plot_y_range[0])
            plot_y_range[0] = this.goal;

        plot_y_range[0] -= this.padding.bottom * (plot_y_range[1] - plot_y_range[0]);
        plot_y_range[1] += this.padding.top * (plot_y_range[1] - plot_y_range[0]);

        this.y.domain(plot_y_range);
        this.y.range([this.height, 0]);
    }

    /**
     * Updates this.x to contain correctly map x_values depending on the data
     * @memberof LinePlot
     */
    _update_x() {
        // Sort data according to x_values
        this.data.sort((a, b) => {
            if (a.x < b.x)
                return -1;
            if (a.x > b.x)
                return 1;
            return 0;
        });
        this._data_x_range[0] = this.data[0].x;
        this._data_x_range[1] = this.data[this.data.length - 1].x;
        
        let plot_x_range = this._data_x_range.slice(0);
        plot_x_range[0] -= this.padding.left * (plot_x_range[1] - plot_x_range[0]);
        plot_x_range[1] += this.padding.right * (plot_x_range[1] - plot_x_range[0]);

        this.x.domain(plot_x_range);
        this.x.range([0, this.width]);
    }

    _update_graph() {
        // They haven't been initialized or first drawn
        if (!this.line || !this.shaded_area)
            return;
        
        // Recompute axis and units
        d3.selectAll(".unit").remove();
        d3.selectAll(".axis_line").remove();
        this._draw_axes();

        // Update the shaded area and line
        this._update_line();

        // Transition dots and then bring them to front
        if (this.show_dots) {
            this.dots = this.svg.selectAll("circle").data(this.data);
            this.dots.transition()
                .attr("cx", (d) => this.x(d.x))
                .attr("cy", (d) => this.y(d.y));
            this.dots.node().parentElement.appendChild(this.dots.node());
        }

        // Update goal line indicator
        this._update_goal();
    }

    _update_goal() {
        if (!this.show_goal)
            return

        this.goal_text.transition()
            .attr("x", this.x(0) + this.goal_text_padding)
            .attr("y", this.y(this.goal));
        
        let goal_text_width = this.goal_text.node().getBBox().width;
        let path_string = `M ${this.x(this.data[0].x) + goal_text_width + 2 * this.goal_text_padding} 
            ${this.y(this.goal)} L ${this.width} ${this.y(this.goal)}`;
        this.goal_indicator.transition().attr("d", path_string);
    }

    _update_line() {
        let path_string = `M ${this.x(this.data[0].x)} ${this.y(this.data[0].y)}`;
        for (let i = 1; i < this.data.length; i++) 
            path_string += `L ${this.x(this.data[i].x)} ${this.y(this.data[i].y)} `;

        // Update line
        this.line.attr("d", path_string);

        // Update shaded area
        path_string += ` L ${this.x(this.data[this.data.length - 1].x)} ${this.y(0)}`;
        path_string += ` L ${this.x(this.data[0].x)} ${this.y(0)} Z`;
        this.shaded_area
            .attr("d", path_string);
    }

    _draw_axes() {
        // Step function's input is the width of a domain and outputs the length
        // between each grid line
        let step_func = (x) => {
            let log = (x, b) => Math.log(x) / Math.log(b);
            let base = 10;
            let power_of_ten = Math.pow(base, Math.floor(log(x, base) - 1));
            let max_index = 6;
            let index = Math.floor((log(x, base) - Math.floor(log(x, base))) * max_index);
            let multiplier = index * index + 1; // multipler = f(x) = x^2 + 1 = 1, 2, 5
            
            return power_of_ten * multiplier;
        }

        // Each step is the distance between one grid line
        let plot_x_range = this.x.domain();
        let plot_y_range = this.y.domain();
        let step_size_x = step_func(plot_x_range[1] - plot_x_range[0]);
        let step_size_y = step_func(plot_y_range[1] - plot_y_range[0]);

        // x_start, x_end is how many steps (grid lines) you take to reach its position
        let x_start = Math.floor(plot_x_range[0] / step_size_x);
        let x_end = Math.floor(plot_x_range[1] / step_size_x);
        let y_start = Math.floor(plot_y_range[0] / step_size_y);
        let y_end = Math.floor(plot_y_range[1] / step_size_y);

        let min_x = this._data_x_range[0];
        function draw_axes(self, start, end, step, is_horizontal) {
            let main_axis_offset = 0;
            for (let n = start; n <= end; n++) {
                let line_coord = (is_horizontal) ? self.y(n * step) : self.x(n * step);

                // Out of view box
                if (((line_coord < 0 || line_coord >= self.height) && is_horizontal) ||
                    ((line_coord < 0 || line_coord >= self.width)  && !is_horizontal))
                    continue;

                let text = self.svg.append("text")
                    .attr("class", "unit")
                    .attr("x", (is_horizontal) ? 10 : line_coord)
                    .attr("y", (is_horizontal) ? line_coord  : self.y(0) + self.text_padding)
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", (is_horizontal) ? "middle" : "hanging")
                    .style("font-size", self.font_height + "px")
                    .append("tspan")
                    .text((is_horizontal) ? (n * step).toFixed(1) : (n * step).toFixed(0));
                
                let text_width = text.node().getBBox().width;
                let text_height = text.node().getBBox().height;
                if ( is_horizontal && n == 0) main_axis_offset = text_width;
                if (!is_horizontal && n == 0) main_axis_offset = text_height;

                let path_string = (is_horizontal) ?
                    `M ${text_width + self.text_padding} ${line_coord} L ${self.width} ${line_coord}` :
                    `M ${line_coord} 0 L ${line_coord} ${self.height - text_height - self.text_padding}`;

                if (self.show_grid_lines)
                    self.svg.append("path")
                        .attr("class", "axis_line")
                        .attr("d", path_string)
                        .attr("fill", "transparent")
                        .attr("stroke", "black")
                        .attr("stroke-width", 1)
                        .attr("stroke-opacity", 0.2);
            }

            let path_string = (is_horizontal) 
                ? `M ${main_axis_offset + self.text_padding} ${self.y(0)} L ${self.width} ${self.y(0)}` 
                : `M ${self.x(min_x)} ${0} L ${self.x(min_x)} ${self.height - self.text_padding - main_axis_offset}`;

            // Draw bolded main axis
            self.svg.append("path")
                .attr("class", "axis_line")
                .attr("d", path_string)
                .attr("fill", "transparent")
                .attr("stroke", "black")
                .attr("stroke-width", 1)
                .attr("stroke-opacity", 0.2);
        }
        
        draw_axes(this, y_start, y_end, step_size_y, true);
        draw_axes(this, x_start, x_end, step_size_x, false);
    }

    set_x_label(string) {
        this.x_label_text = string;
        this.x_label.text(this.x_label_text);
    }

    set_y_label(string) {
        this.y_label_text = string;
        this.y_label.text(string);
    }

    set_title(string) {
        this.title_text = string;
        this.title.text(this.title_text);
    }

    /**
     * Adds a data point to the line plot
     * @param {Object} point - the data to add, formatted in the form {x: ~, y: ~}
     * @memberof LinePlot
     */
    add_point(point) {
        this.data.push(point);
        this._update_x();
        this._update_y();

        if (this.show_dots)
            this.svg.append("circle")
                .attr("cx", this.x(point.x))
                .attr("cy", this.y(point.y))
                .attr("r", this.dot_radius)
                .attr("stroke", this.dot_stroke)
                .attr("stroke-width", 2)
                .style("fill", this.line_stroke);

        this._update_graph();
    }

    /**
     * Adds a data point to the line plot, but also removes the first value on the line plot
     * @param {Object} point - the data to add, formatted in the form {x: ~, y: ~}
     * @memberof LinePlot
     */
    shift_point(point) {
        this.data.push(point);
        this.data.shift();
        this._update_x();
        this._update_y();

        this._update_line();
        // let transition_duration = 10;

        // this.line
        //     .attr("transform", null)
        //     .transition()
        //     .duration(transition_duration)
        //     .attr("transform", `translate(${this.x(0) - this.x(1)}, 0)`);
        // this.shaded_area
        //     .attr("transform", null)
        //     .transition()
        //     .duration(transition_duration)
        //     .attr("transform", `translate(${this.x(0) - this.x(1)}, 0)`);
        
        
        // Recompute axis and units
        d3.selectAll(".unit").remove();
        d3.selectAll(".axis_line").remove();
        this._draw_axes();

        this._update_goal();
    }

    /**
     * Sets the plot to show or not show dots
     * @param {boolean} value - true = show dots, false = do not show dots
     * @memberof LinePlot
     */
    set_show_dots(value) {
        this.show_dots = value;

        if (!this.show_dots)
            this.container.selectAll("circle").remove();
        else {
            this.dots = this.svg.selectAll("circle")
                .data(this.data)
                .enter().append("circle")
                .attr("cx", (d) => this.x(d.x))
                .attr("cy", (d) => this.y(d.y))
                .attr("r", this.dot_radius)
                .attr("stroke", this.dot_stroke)
                .attr("stroke-width", 2)
                .style("fill", this.line_stroke);
        }
    }

    /**
     * Sets the width of the lineplot and renders update
     * @param {double} width 
     */
    set_width(width) {
        this.width = width;
        this.svg.transition()
            .attr("width", this.width + "px");

        this._update_x();
        this._update_y();
        this._update_graph();
    }
}