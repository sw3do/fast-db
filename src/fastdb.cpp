#include <napi.h>
#include <unordered_map>
#include <string>
#include <fstream>
#include <sstream>
#include <cstdint>
#include <stdexcept>
#include <vector>
#include <algorithm>

class SimpleJSON {
public:
    struct Value {
        enum Type { STRING, OBJECT, ARRAY, NUMBER, BOOLEAN, NULL_VALUE };
        Type type;
        std::string string_value;
        std::unordered_map<std::string, Value> object_value;
        std::vector<Value> array_value;
        double number_value;
        bool boolean_value;
        
        Value() : type(NULL_VALUE) {}
        Value(const std::string& s) : type(STRING), string_value(s) {}
        Value(double n) : type(NUMBER), number_value(n) {}
        Value(bool b) : type(BOOLEAN), boolean_value(b) {}
    };
    
    static Value parse(const std::string& json_str);
    static std::string stringify(const Value& value);
    
private:
    static Value parseValue(const std::string& str, size_t& pos);
    static Value parseObject(const std::string& str, size_t& pos);
    static Value parseArray(const std::string& str, size_t& pos);
    static std::string parseString(const std::string& str, size_t& pos);
    static double parseNumber(const std::string& str, size_t& pos);
    static void skipWhitespace(const std::string& str, size_t& pos);
    static std::string escapeString(const std::string& str);
};

class FastDB : public Napi::ObjectWrap<FastDB> {
private:
    std::unordered_map<std::string, std::string> data;
    std::string filename;

public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports);
    FastDB(const Napi::CallbackInfo& info);
    
    Napi::Value Set(const Napi::CallbackInfo& info);
    Napi::Value Get(const Napi::CallbackInfo& info);
    Napi::Value Delete(const Napi::CallbackInfo& info);
    Napi::Value Has(const Napi::CallbackInfo& info);
    Napi::Value Clear(const Napi::CallbackInfo& info);
    Napi::Value Size(const Napi::CallbackInfo& info);
    Napi::Value Keys(const Napi::CallbackInfo& info);
    Napi::Value Values(const Napi::CallbackInfo& info);
    Napi::Value Save(const Napi::CallbackInfo& info);
    Napi::Value Load(const Napi::CallbackInfo& info);
    
private:
    bool SaveToBinary();
    bool LoadFromBinary();
    void WriteString(std::ofstream& file, const std::string& str);
    std::string ReadString(std::ifstream& file);
    bool IsValidFilename(const std::string& filename);
    
    // Nested property helpers
    std::vector<std::string> splitPath(const std::string& path);
    bool setNestedProperty(SimpleJSON::Value& root, const std::vector<std::string>& path, const std::string& value);
    std::string getNestedProperty(const SimpleJSON::Value& root, const std::vector<std::string>& path);
    bool deleteNestedProperty(SimpleJSON::Value& root, const std::vector<std::string>& path);
    bool hasNestedProperty(const SimpleJSON::Value& root, const std::vector<std::string>& path);
    std::string convertToString(const Napi::Value& value);
};

FastDB::FastDB(const Napi::CallbackInfo& info) : Napi::ObjectWrap<FastDB>(info) {
    Napi::Env env = info.Env();
    
    if (info.Length() > 0 && info[0].IsString()) {
        std::string filename = info[0].As<Napi::String>().Utf8Value();
        if (!IsValidFilename(filename)) {
            Napi::TypeError::New(env, "Invalid filename").ThrowAsJavaScriptException();
            return;
        }
        this->filename = filename;
    } else {
        this->filename = "fastdb.bin";
    }
    
    LoadFromBinary();
}

bool FastDB::IsValidFilename(const std::string& filename) {
    if (filename.empty() || filename.length() > 255) return false;
    
    std::string invalid_chars = "<>:\"|?*";
    for (char c : invalid_chars) {
        if (filename.find(c) != std::string::npos) return false;
    }
    return true;
}

void FastDB::WriteString(std::ofstream& file, const std::string& str) {
    if (!file.is_open()) return;
    
    uint32_t length = static_cast<uint32_t>(str.length());
    file.write(reinterpret_cast<const char*>(&length), sizeof(length));
    if (length > 0) {
        file.write(str.c_str(), length);
    }
}

std::string FastDB::ReadString(std::ifstream& file) {
    if (!file.is_open()) return "";
    
    uint32_t length;
    file.read(reinterpret_cast<char*>(&length), sizeof(length));
    if (file.fail() || file.eof() || length > 10000000) return "";
    
    if (length == 0) return "";
    
    std::string str(length, '\0');
    file.read(&str[0], length);
    if (file.fail() || file.eof()) return "";
    
    return str;
}

bool FastDB::SaveToBinary() {
    try {
        std::ofstream file(filename, std::ios::binary | std::ios::trunc);
        if (!file.is_open()) return false;
        
        file.rdbuf()->pubsetbuf(nullptr, 32768);
        
        const char magic[] = "FSTDB";
        file.write(magic, 5);
        
        uint32_t version = 1;
        file.write(reinterpret_cast<const char*>(&version), sizeof(version));
        
        uint32_t count = static_cast<uint32_t>(data.size());
        file.write(reinterpret_cast<const char*>(&count), sizeof(count));
        
        for (const auto& pair : data) {
            WriteString(file, pair.first);
            WriteString(file, pair.second);
            if (file.fail()) return false;
        }
        
        file.flush();
        file.close();
        return file.good();
    } catch (...) {
        return false;
    }
}

bool FastDB::LoadFromBinary() {
    try {
        std::ifstream file(filename, std::ios::binary);
        if (!file.is_open()) return true;
        
        file.rdbuf()->pubsetbuf(nullptr, 32768);
        
        char magic[6] = {0};
        file.read(magic, 5);
        if (file.fail() || std::string(magic) != "FSTDB") {
            file.close();
            return true;
        }
        
        uint32_t version;
        file.read(reinterpret_cast<char*>(&version), sizeof(version));
        if (file.fail() || version != 1) {
            file.close();
            return false;
        }
        
        uint32_t count;
        file.read(reinterpret_cast<char*>(&count), sizeof(count));
        if (file.fail() || count > 10000000) {
            file.close();
            return false;
        }
        
        data.clear();
        data.reserve(count);
        
        for (uint32_t i = 0; i < count; i++) {
            std::string key = ReadString(file);
            std::string value = ReadString(file);
            
            if (file.fail() || file.eof()) break;
            if (!key.empty()) {
                data.emplace(std::move(key), std::move(value));
            }
        }
        
        file.close();
        return true;
    } catch (...) {
        data.clear();
        return false;
    }
}

Napi::Object FastDB::Init(Napi::Env env, Napi::Object exports) {
    Napi::Function func = DefineClass(env, "FastDB", {
        InstanceMethod("set", &FastDB::Set),
        InstanceMethod("get", &FastDB::Get),
        InstanceMethod("delete", &FastDB::Delete),
        InstanceMethod("has", &FastDB::Has),
        InstanceMethod("clear", &FastDB::Clear),
        InstanceMethod("size", &FastDB::Size),
        InstanceMethod("keys", &FastDB::Keys),
        InstanceMethod("values", &FastDB::Values),
        InstanceMethod("save", &FastDB::Save),
        InstanceMethod("load", &FastDB::Load)
    });

    Napi::FunctionReference* constructor = new Napi::FunctionReference();
    *constructor = Napi::Persistent(func);
    env.SetInstanceData(constructor);

    exports.Set("FastDB", func);
    return exports;
}

Napi::Value FastDB::Set(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 2) {
        Napi::TypeError::New(env, "Expected 2 arguments: key and value").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    if (!info[0].IsString()) {
        Napi::TypeError::New(env, "Key must be a string").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    std::string key = info[0].As<Napi::String>().Utf8Value();
    if (key.empty() || key.length() > 1000) {
        Napi::TypeError::New(env, "Key must be 1-1000 characters").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    std::string value = convertToString(info[1]);
    
    if (value.length() > 10000000) {
        Napi::TypeError::New(env, "Value too large (max 10MB)").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    // Handle nested properties with dot notation
    if (key.find('.') != std::string::npos) {
        std::vector<std::string> path = splitPath(key);
        if (!path.empty()) {
            // Get current root data
            SimpleJSON::Value root;
            auto it = data.find("__root__");
            if (it != data.end()) {
                root = SimpleJSON::parse(it->second);
            } else {
                root.type = SimpleJSON::Value::OBJECT;
            }
            
            // Set nested property
            if (setNestedProperty(root, path, value)) {
                data["__root__"] = SimpleJSON::stringify(root);
                SaveToBinary();
                return info.This();
            }
        }
        return env.Null();
    }
    
    this->data[key] = value;
    SaveToBinary();
    return info.This();
}

Napi::Value FastDB::Get(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1) {
        Napi::TypeError::New(env, "Key argument required").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    if (!info[0].IsString()) {
        Napi::TypeError::New(env, "Key must be a string").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    std::string key = info[0].As<Napi::String>().Utf8Value();
    
    // Handle nested properties with dot notation  
    if (key.find('.') != std::string::npos) {
        std::vector<std::string> path = splitPath(key);
        if (!path.empty()) {
            auto it = data.find("__root__");
            if (it != data.end()) {
                SimpleJSON::Value root = SimpleJSON::parse(it->second);
                std::string result = getNestedProperty(root, path);
                if (!result.empty()) {
                    return Napi::String::New(env, result);
                }
            }
        }
        return env.Null();
    }
    
    auto it = this->data.find(key);
    if (it != this->data.end()) {
        return Napi::String::New(env, it->second);
    }
    
    return env.Null();
}

Napi::Value FastDB::Delete(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1) {
        Napi::TypeError::New(env, "Key argument required").ThrowAsJavaScriptException();
        return Napi::Boolean::New(env, false);
    }
    
    if (!info[0].IsString()) {
        Napi::TypeError::New(env, "Key must be a string").ThrowAsJavaScriptException();
        return Napi::Boolean::New(env, false);
    }
    
    std::string key = info[0].As<Napi::String>().Utf8Value();
    
    // Handle nested properties with dot notation
    if (key.find('.') != std::string::npos) {
        std::vector<std::string> path = splitPath(key);
        if (!path.empty()) {
            auto it = data.find("__root__");
            if (it != data.end()) {
                SimpleJSON::Value root = SimpleJSON::parse(it->second);
                if (deleteNestedProperty(root, path)) {
                    data["__root__"] = SimpleJSON::stringify(root);
                    SaveToBinary();
                    return Napi::Boolean::New(env, true);
                }
            }
        }
        return Napi::Boolean::New(env, false);
    }
    
    auto it = this->data.find(key);
    if (it != this->data.end()) {
        this->data.erase(it);
        SaveToBinary();
        return Napi::Boolean::New(env, true);
    }
    
    return Napi::Boolean::New(env, false);
}

Napi::Value FastDB::Has(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1) {
        Napi::TypeError::New(env, "Key argument required").ThrowAsJavaScriptException();
        return Napi::Boolean::New(env, false);
    }
    
    if (!info[0].IsString()) {
        Napi::TypeError::New(env, "Key must be a string").ThrowAsJavaScriptException();
        return Napi::Boolean::New(env, false);
    }
    
    std::string key = info[0].As<Napi::String>().Utf8Value();
    
    // Handle nested properties with dot notation
    if (key.find('.') != std::string::npos) {
        std::vector<std::string> path = splitPath(key);
        if (!path.empty()) {
            auto it = data.find("__root__");
            if (it != data.end()) {
                SimpleJSON::Value root = SimpleJSON::parse(it->second);
                return Napi::Boolean::New(env, hasNestedProperty(root, path));
            }
        }
        return Napi::Boolean::New(env, false);
    }
    
    return Napi::Boolean::New(env, this->data.find(key) != this->data.end());
}

Napi::Value FastDB::Clear(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    this->data.clear();
    SaveToBinary();
    return info.This();
}

Napi::Value FastDB::Size(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    return Napi::Number::New(env, this->data.size());
}

Napi::Value FastDB::Keys(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    Napi::Array keys = Napi::Array::New(env, this->data.size());
    size_t index = 0;
    for (const auto& pair : this->data) {
        keys[index++] = Napi::String::New(env, pair.first);
    }
    return keys;
}

Napi::Value FastDB::Values(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    Napi::Array values = Napi::Array::New(env, this->data.size());
    size_t index = 0;
    for (const auto& pair : this->data) {
        values[index++] = Napi::String::New(env, pair.second);
    }
    return values;
}

Napi::Value FastDB::Save(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    bool success = SaveToBinary();
    return Napi::Boolean::New(env, success);
}

Napi::Value FastDB::Load(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    bool success = LoadFromBinary();
    return Napi::Boolean::New(env, success);
}


SimpleJSON::Value SimpleJSON::parse(const std::string& json_str) {
    size_t pos = 0;
    skipWhitespace(json_str, pos);
    if (pos >= json_str.length()) return Value();
    return parseValue(json_str, pos);
}

std::string SimpleJSON::stringify(const Value& value) {
    switch (value.type) {
        case Value::STRING:
            return "\"" + escapeString(value.string_value) + "\"";
        case Value::NUMBER:
            return std::to_string(value.number_value);
        case Value::BOOLEAN:
            return value.boolean_value ? "true" : "false";
        case Value::NULL_VALUE:
            return "null";
        case Value::OBJECT: {
            std::string result = "{";
            bool first = true;
            for (const auto& pair : value.object_value) {
                if (!first) result += ",";
                result += "\"" + escapeString(pair.first) + "\":" + stringify(pair.second);
                first = false;
            }
            result += "}";
            return result;
        }
        case Value::ARRAY: {
            std::string result = "[";
            bool first = true;
            for (const auto& item : value.array_value) {
                if (!first) result += ",";
                result += stringify(item);
                first = false;
            }
            result += "]";
            return result;
        }
    }
    return "null";
}

SimpleJSON::Value SimpleJSON::parseValue(const std::string& str, size_t& pos) {
    skipWhitespace(str, pos);
    if (pos >= str.length()) return Value();
    
    char c = str[pos];
    if (c == '{') return parseObject(str, pos);
    if (c == '[') return parseArray(str, pos);
    if (c == '"') return Value(parseString(str, pos));
    if (c == 't' || c == 'f') {
        if (str.substr(pos, 4) == "true") {
            pos += 4;
            return Value(true);
        }
        if (str.substr(pos, 5) == "false") {
            pos += 5;
            return Value(false);
        }
    }
    if (c == 'n' && str.substr(pos, 4) == "null") {
        pos += 4;
        return Value();
    }
    if (c == '-' || (c >= '0' && c <= '9')) {
        return Value(parseNumber(str, pos));
    }
    return Value();
}

SimpleJSON::Value SimpleJSON::parseObject(const std::string& str, size_t& pos) {
    Value obj;
    obj.type = Value::OBJECT;
    pos++; // skip '{'
    
    skipWhitespace(str, pos);
    if (pos < str.length() && str[pos] == '}') {
        pos++;
        return obj;
    }
    
    while (pos < str.length()) {
        skipWhitespace(str, pos);
        if (pos >= str.length() || str[pos] != '"') break;
        
        std::string key = parseString(str, pos);
        skipWhitespace(str, pos);
        if (pos >= str.length() || str[pos] != ':') break;
        pos++; // skip ':'
        
        Value value = parseValue(str, pos);
        obj.object_value[key] = value;
        
        skipWhitespace(str, pos);
        if (pos >= str.length()) break;
        if (str[pos] == '}') {
            pos++;
            break;
        }
        if (str[pos] == ',') {
            pos++;
            continue;
        }
        break;
    }
    return obj;
}

SimpleJSON::Value SimpleJSON::parseArray(const std::string& str, size_t& pos) {
    Value arr;
    arr.type = Value::ARRAY;
    pos++; // skip '['
    
    skipWhitespace(str, pos);
    if (pos < str.length() && str[pos] == ']') {
        pos++;
        return arr;
    }
    
    while (pos < str.length()) {
        Value value = parseValue(str, pos);
        arr.array_value.push_back(value);
        
        skipWhitespace(str, pos);
        if (pos >= str.length()) break;
        if (str[pos] == ']') {
            pos++;
            break;
        }
        if (str[pos] == ',') {
            pos++;
            continue;
        }
        break;
    }
    return arr;
}

std::string SimpleJSON::parseString(const std::string& str, size_t& pos) {
    if (pos >= str.length() || str[pos] != '"') return "";
    pos++; // skip opening quote
    
    std::string result;
    while (pos < str.length() && str[pos] != '"') {
        if (str[pos] == '\\' && pos + 1 < str.length()) {
            pos++;
            char escaped = str[pos];
            switch (escaped) {
                case '"': result += '"'; break;
                case '\\': result += '\\'; break;
                case '/': result += '/'; break;
                case 'b': result += '\b'; break;
                case 'f': result += '\f'; break;
                case 'n': result += '\n'; break;
                case 'r': result += '\r'; break;
                case 't': result += '\t'; break;
                default: result += escaped; break;
            }
        } else {
            result += str[pos];
        }
        pos++;
    }
    if (pos < str.length()) pos++; // skip closing quote
    return result;
}

double SimpleJSON::parseNumber(const std::string& str, size_t& pos) {
    size_t start = pos;
    if (str[pos] == '-') pos++;
    while (pos < str.length() && ((str[pos] >= '0' && str[pos] <= '9') || str[pos] == '.')) {
        pos++;
    }
    return std::stod(str.substr(start, pos - start));
}

void SimpleJSON::skipWhitespace(const std::string& str, size_t& pos) {
    while (pos < str.length() && (str[pos] == ' ' || str[pos] == '\t' || str[pos] == '\n' || str[pos] == '\r')) {
        pos++;
    }
}

std::string SimpleJSON::escapeString(const std::string& str) {
    std::string result;
    for (char c : str) {
        switch (c) {
            case '"': result += "\\\""; break;
            case '\\': result += "\\\\"; break;
            case '\b': result += "\\b"; break;
            case '\f': result += "\\f"; break;
            case '\n': result += "\\n"; break;
            case '\r': result += "\\r"; break;
            case '\t': result += "\\t"; break;
            default: result += c; break;
        }
    }
    return result;
}

// FastDB nested property helpers
std::vector<std::string> FastDB::splitPath(const std::string& path) {
    std::vector<std::string> parts;
    std::stringstream ss(path);
    std::string part;
    
    while (std::getline(ss, part, '.')) {
        if (!part.empty()) {
            parts.push_back(part);
        }
    }
    return parts;
}

bool FastDB::setNestedProperty(SimpleJSON::Value& root, const std::vector<std::string>& path, const std::string& value) {
    if (path.empty()) return false;
    
    if (root.type != SimpleJSON::Value::OBJECT) {
        root.type = SimpleJSON::Value::OBJECT;
        root.object_value.clear();
    }
    
    SimpleJSON::Value* current = &root;
    for (size_t i = 0; i < path.size() - 1; i++) {
        if (current->object_value.find(path[i]) == current->object_value.end() ||
            current->object_value[path[i]].type != SimpleJSON::Value::OBJECT) {
            current->object_value[path[i]].type = SimpleJSON::Value::OBJECT;
            current->object_value[path[i]].object_value.clear();
        }
        current = &current->object_value[path[i]];
    }
    
    current->object_value[path.back()] = SimpleJSON::Value(value);
    return true;
}

std::string FastDB::getNestedProperty(const SimpleJSON::Value& root, const std::vector<std::string>& path) {
    if (path.empty() || root.type != SimpleJSON::Value::OBJECT) return "";
    
    const SimpleJSON::Value* current = &root;
    for (const std::string& part : path) {
        if (current->type != SimpleJSON::Value::OBJECT ||
            current->object_value.find(part) == current->object_value.end()) {
            return "";
        }
        current = &current->object_value.at(part);
    }
    
    if (current->type == SimpleJSON::Value::STRING) {
        return current->string_value;
    }
    return SimpleJSON::stringify(*current);
}

bool FastDB::deleteNestedProperty(SimpleJSON::Value& root, const std::vector<std::string>& path) {
    if (path.empty() || root.type != SimpleJSON::Value::OBJECT) return false;
    
    SimpleJSON::Value* current = &root;
    for (size_t i = 0; i < path.size() - 1; i++) {
        if (current->type != SimpleJSON::Value::OBJECT ||
            current->object_value.find(path[i]) == current->object_value.end()) {
            return false;
        }
        current = &current->object_value[path[i]];
    }
    
    if (current->type == SimpleJSON::Value::OBJECT &&
        current->object_value.find(path.back()) != current->object_value.end()) {
        current->object_value.erase(path.back());
        return true;
    }
    return false;
}

bool FastDB::hasNestedProperty(const SimpleJSON::Value& root, const std::vector<std::string>& path) {
    if (path.empty() || root.type != SimpleJSON::Value::OBJECT) return false;
    
    const SimpleJSON::Value* current = &root;
    for (const std::string& part : path) {
        if (current->type != SimpleJSON::Value::OBJECT ||
            current->object_value.find(part) == current->object_value.end()) {
            return false;
        }
        current = &current->object_value.at(part);
    }
    return true;
}

std::string FastDB::convertToString(const Napi::Value& value) {
    if (value.IsString()) {
        return value.As<Napi::String>().Utf8Value();
    } else if (value.IsNumber()) {
        return std::to_string(value.As<Napi::Number>().DoubleValue());
    } else if (value.IsBoolean()) {
        return value.As<Napi::Boolean>().Value() ? "true" : "false";
    } else if (value.IsNull() || value.IsUndefined()) {
        return "null";
    }
    return "";
}

Napi::Object InitAll(Napi::Env env, Napi::Object exports) {
    return FastDB::Init(env, exports);
}

NODE_API_MODULE(fastdb, InitAll) 