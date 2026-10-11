// Package wire is the JSON layer between the web app and the engine. It reads the TypeScript Position and writes the search result back.
package wire

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"

	"github.com/tidwall/gjson"

	"github.com/volodymyr-pavlov/go-game/packages/engine/game"
)

// The request looks like the TypeScript Position: board[x][y], where 1 is Black and 2 is White.
const (
	pathBoard    = "board"
	pathToPlay   = "toPlay"
	pathKoPoint  = "koPoint"
	pathCaptures = "captures"
	pathPasses   = "consecutivePasses"
	pathX        = "x"
	pathY        = "y"
)

type jsonPoint struct {
	X int `json:"x"`
	Y int `json:"y"`
}

// Response is the answer for the web app. Move is null when the engine passes.
type Response struct {
	Move    *jsonPoint `json:"move"`
	WinRate float64    `json:"winRate"`
	Visits  int        `json:"visits"`
}

// ErrorResponse is what the web app gets when the request cannot be answered.
type ErrorResponse struct {
	Error string `json:"error"`
}

const (
	minBoardSize = 2
	maxBoardSize = 25
)

// The upper limit stops a hand-made request from freezing the worker. It is far higher than the hardest level in the UI.
const (
	MinPlayouts = 1
	MaxPlayouts = 20000
)

// captureOrder fixes the order the colours are read in, so the first error reported is always the same one.
var (
	captureOrder = []game.Cell{game.Black, game.White}
	captureKeys  = map[game.Cell]string{game.Black: "1", game.White: "2"}
)

func ClampPlayouts(playouts int) int {
	return min(max(playouts, MinPlayouts), MaxPlayouts)
}

func ParsePosition(raw string) (game.Position, error) {
	if !gjson.Valid(raw) {
		return game.Position{}, errors.New("invalid position: not valid JSON")
	}
	request := gjson.Parse(raw)
	if !request.IsObject() {
		return game.Position{}, errors.New("invalid position: not an object")
	}

	board, err := parseBoard(request.Get(pathBoard))
	if err != nil {
		return game.Position{}, err
	}
	toPlay, err := parseStone(request.Get(pathToPlay))
	if err != nil {
		return game.Position{}, err
	}
	ko, err := parseKo(board, request.Get(pathKoPoint))
	if err != nil {
		return game.Position{}, err
	}
	passes, err := parseCount(request.Get(pathPasses), pathPasses)
	if err != nil {
		return game.Position{}, err
	}
	captures, err := parseCaptures(request.Get(pathCaptures))
	if err != nil {
		return game.Position{}, err
	}

	return game.Position{Board: board, ToPlay: toPlay, Ko: ko, Captures: captures, ConsecutivePasses: passes}, nil
}

func parseBoard(columns gjson.Result) (game.Board, error) {
	if !columns.IsArray() {
		return game.Board{}, fmt.Errorf("%s is missing or not an array", pathBoard)
	}
	rows := columns.Array()
	size := len(rows)
	if size < minBoardSize || size > maxBoardSize {
		return game.Board{}, fmt.Errorf("board size %d is not between %d and %d", size, minBoardSize, maxBoardSize)
	}
	b := game.New(size)
	for x, column := range rows {
		cells := column.Array()
		if !column.IsArray() || len(cells) != size {
			return game.Board{}, errors.New("board is not square")
		}
		for y, cell := range cells {
			value, err := parseCell(cell)
			if err != nil {
				return game.Board{}, fmt.Errorf("cell %d,%d: %w", x, y, err)
			}
			b.Set(game.Point{X: x, Y: y}, value)
		}
	}
	return b, nil
}

func isInteger(value gjson.Result) bool {
	return value.Type == gjson.Number && value.Num == math.Trunc(value.Num)
}

func parseCell(cell gjson.Result) (game.Cell, error) {
	if !isInteger(cell) {
		return game.Empty, errors.New("not an integer")
	}
	value := cell.Int()
	if value < int64(game.Empty) || value > int64(game.White) {
		return game.Empty, fmt.Errorf("unknown value %d", value)
	}
	return game.Cell(value), nil
}

func parseStone(value gjson.Result) (game.Cell, error) {
	if !isInteger(value) {
		return game.Empty, fmt.Errorf("%s is missing or not an integer", pathToPlay)
	}
	stone := game.Cell(value.Int())
	if stone != game.Black && stone != game.White {
		return game.Empty, fmt.Errorf("%s %d is not a stone", pathToPlay, value.Int())
	}
	return stone, nil
}

func parseKo(b game.Board, ko gjson.Result) (int, error) {
	if !ko.Exists() || ko.Type == gjson.Null {
		return game.NoKo, nil
	}
	x, y := ko.Get(pathX), ko.Get(pathY)
	if !ko.IsObject() || !isInteger(x) || !isInteger(y) {
		return game.NoKo, fmt.Errorf("%s is not a point", pathKoPoint)
	}
	point := game.Point{X: int(x.Int()), Y: int(y.Int())}
	if !b.OnBoard(point) {
		return game.NoKo, fmt.Errorf("%s %d,%d is outside the board", pathKoPoint, point.X, point.Y)
	}
	return b.Index(point), nil
}

// parseCount reads a whole number that is 0 or more. A missing field is read as 0.
func parseCount(value gjson.Result, name string) (int, error) {
	if !value.Exists() {
		return 0, nil
	}
	if !isInteger(value) || value.Int() < 0 {
		return 0, fmt.Errorf("%s is not a whole number of 0 or more", name)
	}
	return int(value.Int()), nil
}

func parseCaptures(captures gjson.Result) (game.Captures, error) {
	var counts game.Captures
	if !captures.Exists() {
		return counts, nil
	}
	if !captures.IsObject() {
		return counts, fmt.Errorf("%s is not an object", pathCaptures)
	}
	for _, stone := range captureOrder {
		key := captureKeys[stone]
		count, err := parseCount(captures.Get(key), pathCaptures+"."+key)
		if err != nil {
			return counts, err
		}
		counts.Add(stone, count)
	}
	return counts, nil
}

func ToResponse(result game.Result) Response {
	dto := Response{WinRate: result.WinRate, Visits: result.Visits}
	if !result.Move.Pass {
		dto.Move = &jsonPoint{X: result.Move.Point.X, Y: result.Move.Point.Y}
	}
	return dto
}

func ToJSON(v any) string {
	out, err := json.Marshal(v)
	if err != nil {
		return ErrorJSON("cannot encode result: " + err.Error())
	}
	return string(out)
}

// ErrorJSON is the JSON of an ErrorResponse with this message.
func ErrorJSON(message string) string {
	out, _ := json.Marshal(ErrorResponse{Error: message}) // a struct of one string always encodes
	return string(out)
}
